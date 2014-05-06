(function() {
  var mockStorage;
  var server;

  module('sync Module', {
    setup: function() {
      mockStorage = {};
      sinon.stub(localStorage, "getItem", function(item) {
        return mockStorage[item];
      });

      server = sinon.fakeServer.create();
    },
    teardown: function() {
      mockStorage = {};
      localStorage.getItem.restore();

      server.restore();

      sync._private.reset();
    }
  });

  test('syncData- 0 locations', function() {
    expect(2);
    var locations = [];
    var callback = sinon.spy();

    sync.syncData(locations, callback);

    sinon.assert.calledOnce(callback);
    sinon.assert.calledWith(callback, {success: false, message: "No data to sync"});
  });

  test('syncData- 1 location', function() {
    expect(10);
    mockStorage = {
      synced: 'false'
    };

    sync._private.addToSyncLocationDatabase([{dataLocation: {name:'settings'}}], function() {});
    var results = sync._private.getLocations();

    deepEqual(results[0].locationInfo.dataLocation, {
      name: 'settings',
      syncedType: 'database',
      syncedName: 'synced',
      type: 'database',
      syncedValue: 'true',
      unsyncedValue: 'false'
    });
    deepEqual(results[0].locationInfo.send, {
      type: 'POST',
      multipleRequests: true,
      singleParam: 'data',
      retry: '1'
    });
    deepEqual(results[0].locationInfo.receive, {
      successName: 'success',
      successValue: true
    });
    deepEqual(results[0].percentComplete, 0);
    deepEqual(results[0].numberComplete, 0);
    deepEqual(results[0].synced, false);
    deepEqual(results[0].retries, 0);
    deepEqual(results[0].sendData, {});
    deepEqual(results[0].receiveData, {});
    deepEqual(results[0].syncInProgress, false);
  });

  test('syncData- 2 locations', function() {
    expect(8);
    var locations = [
      {
        dataLocation: {
          type: 'localstorage',
          name: ['firstName', 'lastName'],
          syncedType: 'localstorage',
          syncedName: 'settingsSynced'
        },
        send: {
          url: 'http://www.app.com/settings'
        }
      },
      {
        dataLocation: {
          type: 'localstorage',
          name: 'employees',
          syncedType: 'localstorage',
          syncedName: 'employeesSynced'
        },
        send: {
          url: 'http://www.app.com/employees'
        }
      }
    ];
    mockStorage = {
      firstName: 'Bob',
      lastName: 'Smith',
      settingsSynced: 'false',
      employees: 'hello',
      employeesSynced: 'false'
    };
    var results;
    var callback = sinon.spy(function(r) {
      results = r;
      deepEqual(results.success, true);
      deepEqual(results.percentComplete, 100);
    });

    sync.syncData(locations, callback);

    server.respondWith([200, {'Content-Type': 'application/json'}, '{"success": true}']);
    server.respond();

    equal(server.requests.length, 2);
    equal(server.requests[0].url, 'http://www.app.com/settings');
    equal(server.requests[1].url, 'http://www.app.com/employees');
    sinon.assert.calledTwice(callback);
  });

  test('syncData- already synced localStorage', function() {
    expect(4);
    var locations = [{
      dataLocation: {
        type: "localstorage",
        name: "testData",
        syncedType: "localstorage",
        syncedName: "testDataSynced"
      },
      send: {
        url: ''
      }
    }];
    mockStorage = {
      testDataSynced: 'true'
    };
    var results;
    var callback = sinon.spy(function(r) {
      results = r;
    });

    sync.syncData(locations, callback);

    sinon.assert.calledOnce(callback);
    deepEqual(results.success, true);
    deepEqual(results.name, locations[0].dataLocation.name);
    deepEqual(results.percentComplete, 100);
  });

  test('getDatabaseLocationJson(locationString)', function() {
    expect(1);
    deepEqual(sync._private.getDatabaseLocationJson('db.table.id'), {database: 'db', table: 'table', key: 'id'});
  });

  test('syncData- blank locations', function() {
    expect(1);
    var callback = sinon.spy();

    sync.syncData([], callback);
    var results = sync._private.getLocations();
    deepEqual(results, {});
  });

  test('setData- localstorage', function() {
    expect(1);
    var locations = [
      {
        dataLocation: {
          type: 'localstorage',
          name: 'settings',
          syncedType: 'localstorage',
          syncedName: 'settingsSynced'
        }
      }
    ];
    mockStorage = {
      settings: 'stuff',
      settingsSynced: 'false'
    };

    sync.syncData(locations, function() {});
    var results = sync._private.getLocations();

    deepEqual(results[0].sendData, {settings: 'stuff'});
  });

  test('setData- localstorage array', function() {
    expect(1);
    var locations = [
      {
        dataLocation: {
          type: 'localstorage',
          name: ['settingsName', 'settingsAge', 'settingsWeight'],
          syncedType: 'localstorage',
          syncedName: 'settingsSynced'
        }
      }
    ];
    mockStorage = {
      settingsName: 'Bob',
      settingsAge: '35',
      settingsWeight: '180',
      settingsSynced: 'false'
    };

    sync.syncData(locations, function() {});
    var results = sync._private.getLocations();

    deepEqual(results[0].sendData, {settingsName: 'Bob', settingsAge: '35', settingsWeight: '180'});
  });

  test('getDataFromLocalstorage()', function() {
    expect(2);
    var results;
    var locations = [{
      dataLocation: {
       type: 'localStorage',
        name: 'firstName',
        syncedType: 'localstorage',
        syncedName: 'nameSynced'
      },
      synced: false
    }];
    var callback = sinon.spy(function(a){
      results = a;
    });
    mockStorage = {
      firstName: "Bob",
      nameSynced: 'true'
    };

    sync._private.addToSyncLocationDatabase(locations, callback);
    sync._private.getDataFromLocalstorage(0, callback);

    sinon.assert.calledOnce(callback);
    deepEqual(results, {firstName: "Bob"});
  });

  test('sendData', function() {
    expect(6);
    var locations = [
      {
        dataLocation: {
          type: 'localstorage',
          name: 'firstName',
          syncedType: 'localstorage',
          syncedName: 'firstNameSynced'
        },
        send: {
          url: 'http://www.app.com'
        }
      }
    ];
    mockStorage = {
      firstName: 'Bobby',
      firstNameSynced: 'false'
    };
    var results;
    var callback = sinon.spy(function(r) {
      results = r;
      deepEqual(results.success, true);
      deepEqual(results.name, 'firstName');
      deepEqual(results.percentComplete, 100);
    });

    sync.syncData(locations, callback);

    server.respondWith([200, {'Content-Type': 'application/json'}, '{"success": true}']);
    server.respond();

    equal(server.requests.length, 1);
    equal(server.requests[0].url, 'http://www.app.com');
    sinon.assert.calledOnce(callback);
  });

  test('sendData- 404 response should retry request', function() {
    expect(6);
    var locations = [
      {
        dataLocation: {
          type: 'localstorage',
          name: 'firstName',
          syncedType: 'localstorage',
          syncedName: 'firstNameSynced'
        },
        send: {
          url: 'http://www.app.com',
          retry: 3
        }
      }
    ];
    mockStorage = {
      firstName: 'Bobby',
      firstNameSynced: 'false'
    };
    var results;
    var callback = sinon.spy(function(r) {
      results = r;
      deepEqual(results.success, true);
      deepEqual(results.name, 'firstName');
      deepEqual(results.percentComplete, 100);
    });

    sync.syncData(locations, callback);

    server.respondWith([404, {'Content-Type': 'application/json'}, '{"success": true}']);
    server.respond();
    server.respondWith([404, {'Content-Type': 'application/json'}, '{"success": true}']);
    server.respond();
    server.respondWith([200, {'Content-Type': 'application/json'}, '{"success": true}']);
    server.respond();

    equal(server.requests.length, 3);
    equal(server.requests[0].url, 'http://www.app.com');
    sinon.assert.calledOnce(callback);
  });
})();