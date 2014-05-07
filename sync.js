var sync = function() {
  var lastId = 0;
  var syncLocationDatabase = {};

  var SyncLocation = function(locationInfo, callback) {
    this.dataLocation = locationInfo.dataLocation;
    this.send = locationInfo.send;
    this.receive = locationInfo.receive;
    this.callback = callback;

    if(typeof this.dataLocation === 'undefined') { this.dataLocation = 'database'; }
    if(typeof this.dataLocation.type === 'undefined') { this.dataLocation.type = 'database'; }
    if(typeof this.dataLocation.syncedType === 'undefined') { this.dataLocation.syncedType = 'database'; }
    if(typeof this.dataLocation.syncedName === 'undefined') { this.dataLocation.syncedName = 'synced'; }
    if(typeof this.dataLocation.syncedValue === 'undefined') { this.dataLocation.syncedValue = 'true'; }
    if(typeof this.dataLocation.unsyncedValue === 'undefined') { this.dataLocation.unsyncedValue = 'false'; }
    if(typeof this.send === 'undefined') { this.send = {}; }
    if(typeof this.send.type === 'undefined') { this.send.type = 'POST'; }
    if(typeof this.send.multipleRequests === 'undefined') { this.send.multipleRequests = true; }
    if(typeof this.send.singleParam === 'undefined') { this.send.singleParam = 'data'; }
    if(typeof this.send.retry === 'undefined') { this.send.retry = '1'; }
    if(typeof this.receive === 'undefined') { this.receive = {}; }
    if(typeof this.receive.successName === 'undefined') { this.receive.successName = 'success'; }
    if(typeof this.receive.successValue === 'undefined') { this.receive.successValue = true; }
  };

  var SyncLocationFactory = (function() {
    var existingLocations = {}, existingLocation;

    return {
      createLocation: function(locationInfo, callback) {
        var name = locationInfo.dataLocation.name;
        if(typeof name === 'object') {
          name = locationInfo.dataLocation.syncedName;
        }
        existingLocation = existingLocations[name];
        if(!!existingLocation) {
          return {};
        } else {
          existingLocation = new SyncLocation(locationInfo, callback);
          existingLocations[name] = existingLocation;
          return existingLocation;
        }
      },

      deleteLocation: function(locationInfo) {
        var name = locationInfo.dataLocation.name;
        if(typeof name === 'object') {
          name = locationInfo.dataLocation.syncedName;
        }
        existingLocation = existingLocations[name];
        if(!!existingLocation) {
          delete existingLocations[name];
          return true;
        } else {
          return false;
        }
      },

      getLocations: function() {
        return existingLocations;
      },

      destroyLocations: function() {
        existingLocations = {};
      }
    };
  });
  var syncLocationFactory = new SyncLocationFactory();

  var syncData = function(locations, callback) {
    if(locations.length < 1) {
      return callback({
        success: false,
        message: "No data to sync"
      });
    }

    addToSyncLocationDatabase(locations, callback);
    for(var locationId in syncLocationDatabase) {
      sendData(locationId);
    }
  };

  var addToSyncLocationDatabase = function(locations, callback) {
    var syncLocation = {};
    var id;
    for(var i = 0; i < locations.length; i++) {
      syncLocation = syncLocationFactory.createLocation(locations[i], callback);
      if(typeof syncLocation.send !== 'undefined') {
        id = getNextDatabaseId();
        syncLocationDatabase[id] = {
          percentComplete: 0,
          numberComplete: 0,
          synced: false,
          retries: 0,
          sendData: {},
          receiveData: {},
          syncInProgress: false,
          locationInfo: syncLocation
        };
      }
    }
  };

  var getNextDatabaseId = function() {
    return lastId++;
  };

  var sendData = function(locationId) {
    var syncLocation = syncLocationDatabase[locationId];
    syncLocationDatabase[locationId].syncInProgress = true;

    setData(
      locationId,
      function() {
        if(typeof syncLocation.sendData.length !== 'undefined'){
          for(var i = 0; i < syncLocation.sendData.length; i++) {
            sendAjax(locationId, i);
          }
        } else {
         sendAjax(locationId);
        }
      },
      function() {
        returnCallbacks(locationId);
        markLocationAsSynced(locationId);
      }
    );
  };

  var sendAjax = function(locationId, sendDataIndex) {
    var syncLocation = syncLocationDatabase[locationId];
    var data;
    if(typeof sendDataIndex === 'undefined') {
      data = syncLocation.sendData;
    } else {
      data = syncLocation.locationInfo.send.singleParam + '=' + JSON.stringify(syncLocation.sendData[sendDataIndex]);
    }
    $.ajax({
      type: syncLocation.locationInfo.send.type,
      url: syncLocation.locationInfo.send.url,
      dataType: 'json',
      data: data,
      async: true,
      success: function(json, status, response) {
        receiveRequest(locationId, sendDataIndex, response.status, json);
      },
      error: function(response) {
        console.log('status = ' + response.status);
        console.log('Ajax Error- url=' + syncLocation.locationInfo.send.url + ' data=' + syncLocation.sendData + ' type=' + syncLocation.locationInfo.send.type);
        receiveRequest(locationId, sendDataIndex, status, {});
      }
    });
  };

  var setData = function(locationId, unsyncedCallback, syncedCallback) {
    var syncLocation = syncLocationDatabase[locationId];
    var alterFunction;

    if(typeof syncLocation.locationInfo.send !== 'undefined' && typeof syncLocation.locationInfo.send.alterData !== 'undefined') {
      alterFunction = syncLocation.locationInfo.send.alterData;
    } else {
      alterFunction = function(json) { return json; };
    }
    if(syncLocation.locationInfo.dataLocation.type === 'database') {
      getDataFromDatabase(locationId, function(locationId, data) {
        syncLocationDatabase[locationId].sendData = alterFunction(data);
        unsyncedCallback();
      });
    } else if(syncLocation.locationInfo.dataLocation.type === 'localstorage') {
      var syncedName = syncLocation.locationInfo.dataLocation.syncedName;
      if(window.localStorage.getItem(syncedName) === 'false') {
        getDataFromLocalstorage(locationId, function(data) {
          syncLocationDatabase[locationId].sendData = alterFunction(data);
          unsyncedCallback();
        });
      } else {
        syncLocationDatabase[locationId].numberComplete = 1;
        syncLocationDatabase[locationId].percentComplete = 100;
        syncedCallback();
      }
    }
  };

  var getDataFromDatabase = function(locationId, callback) {
    var location = syncLocationDatabase[locationId];
    var databaseLocationJson = getDatabaseLocationJson(location.locationInfo.dataLocation.name);
    var db = window.openDatabase(databaseLocationJson.database, "", databaseLocationJson.database, 1000000);

    var whereClause = '';
    if(location.locationInfo.dataLocation.syncedType === 'database') {
      whereClause = 'WHERE ' + location.locationInfo.dataLocation.syncedName + ' = ' + location.locationInfo.dataLocation.unsyncedValue;
    } else if(location.locationInfo.dataLocation.syncedType === 'localstorage'){
      var rowsToSync = JSON.parse(window.localStorage.getItem(location.locationInfo.dataLocation.syncedName));
      if(rowsToSync !== null) {
        for(var i = 0; i < rowsToSync.length; i++) {
          if(i === 0) {
            whereClause = 'WHERE ';
          } else {
            whereClause += ' OR ';
          }
          whereClause += databaseLocationJson.key + ' = ' + rowsToSync[i];
        }
      } else {
        callback(locationId, []);
      }
    }

    query(databaseLocationJson.database, 'SELECT * FROM ' + databaseLocationJson.table + ' ' + whereClause,
      function(results) {
        convertDatabaseResultsToJson(locationId, results, callback);
      }
    );
  };

  var query = function(databaseName, query, callback) {
    var db = window.openDatabase(databaseName, "", databaseName, 1000000);

    db.transaction(function(tx) {
      tx.executeSql(query, [], function(tx, results) {
        if(typeof callback === 'function') {
          return callback({success: true, rowsAffected: results.rows.length, data: results}, callback);
        }
      }, function(tx, error) {
        if(typeof callback === 'function') {
          return callback([]);
        }
      });
    });
  };

  var getDatabaseLocationJson = function(locationString) {
    var json = {
      database: '',
      table: '',
      key: 'id'
    };
    var array = locationString.split('.');
    if(array.length > 2) json.key = array[2];
    if(array.length > 1) json.table = array[1];
    if(array.length > 0) json.database = array[0];
    return json;
  };

  var getDataFromLocalstorage = function(locationId, callback) {
    var names = syncLocationDatabase[locationId].locationInfo.dataLocation.name;
    var json = {};
    if(typeof names === 'object') {
      for(var i = 0; i < names.length; i++) {
        json[names[i]] = window.localStorage.getItem(names[i]);
      }
    } else {
      json[names] = window.localStorage.getItem(names);
    }
    callback(json);
  };

  var getReturnJson = function(locationId, success) {
    success = success || true;
    var syncLocation = syncLocationDatabase[locationId];
    return {
      success: success,
      name: syncLocation.locationInfo.dataLocation.name,
      percentComplete: syncLocation.percentComplete,
      data: syncLocation.receiveData
    };
  };

  var receiveRequest = function(locationId, sendDataIndex, statusCode, json) {
    var syncLocation = syncLocationDatabase[locationId];
    var percentComplete;
    if(statusCode !== 200) {
      if(syncLocation.retries < syncLocation.locationInfo.send.retry) {
        syncLocationDatabase[locationId].retries++;
        sendAjax(locationId, sendDataIndex);
      } else {
        syncLocationDatabase[locationId].syncInProgress = false;
        returnCallbacks(locationId, false);
      }
    } else {
      if(json[syncLocation.locationInfo.receive.successName] === syncLocation.locationInfo.receive.successValue) {
        if(typeof syncLocation.sendData.length === 'undefined') {
          percentComplete = 100;
        } else {
          percentComplete = Math.floor(syncLocation.sendData.length / syncLocation.numberComplete * 100);
        }
        if(percentComplete === 100) syncLocationDatabase[locationId].synced = true;
        syncLocationDatabase[locationId].percentComplete = percentComplete;
        syncLocationDatabase[locationId].receiveData = json;
        syncLocationDatabase[locationId].syncInProgress = false;
        returnCallbacks(locationId);
        markLocationAsSynced(locationId, sendDataIndex);
      } else {
        syncLocationDatabase[locationId].syncInProgress = false;
        returnCallbacks(locationId);
      }
    }
  };

  var returnCallbacks = function(locationId, success) {
    success = success || true;
    var syncLocation = syncLocationDatabase[locationId];
    var json = getReturnJson(locationId, success);
    syncLocation.locationInfo.callback(json);
    if(typeof syncLocation.locationInfo.receive.callback === 'function') {
      syncLocation.locationInfo.receive.callback(json);
    }
  };

  var convertDatabaseResultsToJson = function(locationId, results, callback) {
    var json;
    var multipleRequests = syncLocationDatabase[locationId].locationInfo.send.multipleRequests;

    if(multipleRequests === true) {
      json = [];
    } else {
      json = {};
    }
    for(var i = 0; i < results.rowsAffected; i++) {
      json[i] = results.data.rows.item(i);
    }
    return callback(locationId, json);
  };

  var markLocationAsSynced = function(locationId, sendDataIndex) {
    var syncLocation = syncLocationDatabase[locationId];
    syncLocation.synced = true;
    syncLocation.percentComplete = 100;

    if(syncLocation.locationInfo.dataLocation.syncedType === 'database') {
      markDatabaseRowAsSynced(locationId, sendDataIndex);
    } else if(syncLocation.locationInfo.dataLocation.syncedType === 'localstorage') {
      markLocalstorageRowAsSynced(locationId, sendDataIndex);
    }

    syncLocationFactory.deleteLocation(syncLocation.locationInfo);
    delete syncLocationDatabase[locationId];
  };

  var markDatabaseRowAsSynced = function(locationId, sendDataIndex) {
    if(typeof sendDataIndex !== 'undefined') {
      var location = syncLocationDatabase[locationId];
      var databaseLocationJson = getDatabaseLocationJson(location.locationInfo.dataLocation.name);

      var sql = 'UPDATE ' + databaseLocationJson.table + ' SET ' + location.locationInfo.dataLocation.syncedName + ' = ' + location.locationInfo.dataLocation.syncedValue + ' WHERE ' + databaseLocationJson.key + ' = ' + rowsToSync[i];

      query(databaseLocationJson.database, 'SELECT * FROM ' + databaseLocationJson.table + ' ' + whereClause,
        function(results) {
          convertDatabaseResultsToJson(locationId, results, function() {});
        }
      );
    }
  };

  var markLocalstorageRowAsSynced = function(locationId, sendDataIndex) {
    var syncLocation = syncLocationDatabase[locationId];
    var syncedName = syncLocation.locationInfo.dataLocation.syncedName;

    if(typeof sendDataIndex === 'undefined') {
      window.localStorage.setItem(syncedName, syncLocation.locationInfo.dataLocation.syncedValue);
    } else {
      var syncedArray = JSON.parse(window.localStorage.getItem(syncedName));
      var currentValue;
      for(var i = 0; i < syncedArray.length; i++) {
        currentValue = syncedArray[i];
        if(currentValue === sendDataIndex) {
          window.localStorage.setItem(syncedName, syncedArray.splice(i, 1));
        }
      }
    }
  };

  var getLocations = function() {
    return syncLocationDatabase;
  };

  var reset = function() {
    lastId = 0;
    syncLocationDatabase = {};
    syncLocationFactory.destroyLocations();
  };

  var public = {
    syncData: syncData
  };

  /* test-code */
  public._private = {
    SyncLocationFactory: SyncLocationFactory,
    addToSyncLocationDatabase: addToSyncLocationDatabase,
    getDatabaseLocationJson: getDatabaseLocationJson,
    setData: setData,
    sendData: sendData,
    getDataFromDatabase: getDataFromDatabase,
    query: query,
    getDataFromLocalstorage: getDataFromLocalstorage,
    getReturnJson: getReturnJson,
    receiveRequest: receiveRequest,
    returnCallbacks: returnCallbacks,
    convertDatabaseResultsToJson: convertDatabaseResultsToJson,
    markLocationAsSynced: markLocationAsSynced,
    getLocations: getLocations,
    reset: reset
  };
  /* end-test-code */

  return public;
}();