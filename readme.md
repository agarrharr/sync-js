# sync-js

A javascript module to sync localStorage and/or Web SQL data to a server.

## Usage

```js
var locations = [
  {
    dataLocation: {
      type: "database",
      name: "databaseName.tableName.id",
      syncedType: "database",
      syncedName: "synced",
      syncedValue: 'true',
      unsyncedValue: 'false'
    },
    send: {
      url: "https://www.app.com/saveStuff",
      type: "POST",
      multipleRequests: true,
      singleParam: "data",
      alterData: function(json) { return json; },
      retry: '1'
    },
    receive: {
      successName: 'success',
      successValue: true,
      callback: function(json) {}
    }
  },
  {
    dataLocation: {
      name: "zijaExerciseTracker.trackerHistory.id",
      syncedType: "database",
      syncedName: "synced",
      syncedValue: 1,
      unsyncedValue: 0
    },
    send: {
      url: "https://www.release.zijamobile.com/ExerciseTracker/Index/save"
    }
  }
];

var callback = function(json) {
  if(json.success === true) {
    if(typeof json.percentComplete !== 'undefined') {
      $('#percentComplete' + json.dataName).html(json.percentComplete + "%");
    }
  } else if (json.success === false) {
    $('#errorMessage' + json.dataName).html(percent + "%");
  }
};

sync.syncData(locations, callback);
```

## Contributing

I believe that everything is working, but feel free to put in an issue  or to fork and make a pull request.
