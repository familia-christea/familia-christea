// Casa Christea - Service Worker
var CACHE = "christea-sw-v1";

self.addEventListener("install", function(e){ self.skipWaiting(); });
self.addEventListener("activate", function(e){ e.waitUntil(clients.claim()); });

// Store scheduled timers
var _timers = {};

self.addEventListener("message", function(e){
  if(!e.data) return;
  var data = e.data;

  if(data.type === "PING"){
    e.source && e.source.postMessage({type:"PONG"});
    return;
  }

  if(data.type === "SCHEDULE"){
    // Cancel existing timer for same tag
    if(_timers[data.tag]) clearTimeout(_timers[data.tag]);

    var delay = data.delay || 0;
    if(delay < 0) delay = 0;

    _timers[data.tag] = setTimeout(function(){
      delete _timers[data.tag];
      showAgendaNotification(data);
    }, delay);
    return;
  }

  if(data.type === "CANCEL"){
    if(_timers[data.tag]){
      clearTimeout(_timers[data.tag]);
      delete _timers[data.tag];
    }
    self.registration.getNotifications({tag: data.tag}).then(function(ns){
      ns.forEach(function(n){ n.close(); });
    });
    return;
  }

  if(data.type === "CANCEL_ALL"){
    Object.keys(_timers).forEach(function(k){ clearTimeout(_timers[k]); });
    _timers = {};
    self.registration.getNotifications().then(function(ns){
      ns.forEach(function(n){ n.close(); });
    });
    return;
  }
});

function showAgendaNotification(data){
  var options = {
    body:             data.body || "",
    tag:              data.tag  || "christea",
    icon:             "/icon-192.png",
    badge:            "/icon-192.png",
    requireInteraction: true,   // fica na tela ate o usuario agir
    silent:           false,
    vibrate:          [300, 150, 300, 150, 300],
    renotify:         true,
    actions:          data.actions || [],
    data:             data.payload || {}
  };
  return self.registration.showNotification(data.title || "Casa dos Campeoes", options);
}

self.addEventListener("notificationclick", function(e){
  e.notification.close();
  var action  = e.action || "default";
  var payload = e.notification.data || {};
  payload.action = action;

  e.waitUntil(
    clients.matchAll({type:"window", includeUncontrolled:true}).then(function(list){
      // Try to find an open window
      var found = null;
      for(var i=0; i<list.length; i++){
        if(list[i].url.indexOf(payload.origin||"") > -1){
          found = list[i]; break;
        }
      }
      if(found){
        return found.focus().then(function(c){
          c.postMessage({type:"NOTIF_ACTION", action:action, payload:payload});
        });
      }
      // Open new window if none found
      var url = (payload.origin||self.registration.scope) +
        "?na=" + action +
        "&aid=" + (payload.agendaId||"") +
        "&nt="  + (payload.notifType||"");
      return clients.openWindow(url);
    })
  );
});

self.addEventListener("notificationclose", function(e){
  // User dismissed without clicking
  var payload = e.notification.data || {};
  // Notify app if open
  clients.matchAll({type:"window"}).then(function(list){
    list.forEach(function(c){
      c.postMessage({type:"NOTIF_DISMISSED", payload:payload});
    });
  });
});
