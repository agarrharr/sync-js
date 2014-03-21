sync-js
=====================

A javascript module to sync localStorage and/or Web SQL data to a server.

Usage
=====================
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
      }];

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

Options
=====================



Contributing
=====================

I believe that everything is working, but feel free to put in an issue  or to fork and make a pull request.

Copyright
=====================

The MIT License (MIT)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.