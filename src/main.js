function mediaSlider(window, jQuery, dropzoneJS, options) {
    var DB;

    function constructor() {
        initDB().then(function() {
            initHTML();
            initDropzone();
            iterateMedia().then(function() {
                initJcarousel();
            });
        }, function() {
            console.error(arguments);
        }, function () {
            console.log('db initialisation done.');
        });
    }

    function initHTML() {
        jQuery(options.element).html(
            '<div id="' + options.dropzoneSelector + '" class="dropzone"></div>' +
            '<div class="jcarousel-wrapper">' +
            '<div class="jcarousel"><ul id="' + options.sliderSelector + '"></ul></div>'+
            '<a href="#" class="jcarousel-control-prev">&lsaquo;</a>\n' +
            '<a href="#" class="jcarousel-control-next">&rsaquo;</a>' +
            '</div>'
        );
    }

    function initDB() {
        // Promise
        var deferred = new jQuery.Deferred();

        // IndexedDB
        window.indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
        window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.OIDBTransaction || window.msIDBTransaction;
        var dbVersion = 1;

        /*
            Note: The recommended way to do this is assigning it to window.indexedDB,
            to avoid potential issues in the global scope when web browsers start
            removing prefixes in their implementations.
            You can assign it to a varible, like var indexedDB… but then you have
            to make sure that the code is contained within a function.
            // Set img src to ObjectURL
            var imgElephant = document.getElementById("elephant");
            imgElephant.setAttribute("src", imgURL);

        */

        // Create/open database
        console.log('initialising database ' + options.dbName + '...');
        var request = indexedDB.open(options.dbName, dbVersion);

        request.onsuccess = function (event) {
            DB = event.target.result;
            deferred.resolve();
            console.debug('Success creating/accessing IndexedDB database', event);

            DB.onerror = function (event) {
                console.debug('Error creating/accessing IndexedDB database', event);
                deferred.reject();
            };
        };

        request.onerror = function(event) {
            deferred.reject(event);
        };

        // This event is only implemented in recent browsers
        request.onupgradeneeded = function(event) {
            // Save the IDBDatabase interface
            DB = event.target.result;
            console.debug('Success upgrading IndexedDB database', event);

            // Create an objectStore for this database
            // same objectstore as db name
            var storage = DB.createObjectStore(options.storeName ); // no keyPath, no autoincrement

            storage.createIndex('fileName', 'fileName', { unique: true });
        };

        return deferred.promise();
    }

    function initDropzone() {
        new dropzoneJS('#' + options.dropzoneSelector, {
            url: '/fake',
            transformFile: transformer,
            init: function() { console.debug('dz done'); }
        });
    }

    function storeInDB(blob, key) {
        var deferred = new jQuery.Deferred();
        console.log('Putting blobs in IndexedDB...', DB, blob);

        // Open a transaction to the database
        var transaction = DB.transaction([options.storeName], 'readwrite');

        // Put the blob into the dabase
        var request = transaction.objectStore(options.storeName).put(blob, key);

        request.onsuccess = function(event) {
            console.log('done.');
            deferred.resolve();
        };

        request.onerror = function(event) {
            console.debug('error saving in store', event);
            deferred.reject();
        };
        return deferred.promise();
    }

    /*
    function loadFromDB(key) {
        var deferred = new jQuery.Deferred();
        // Open a transaction to the database
        var transaction = DB.transaction([options.storeName], 'readonly');

        // Retrieve the file that was just stored
        transaction.objectStore(options.storeName).get(key).onsuccess = function (event) {
            var imgFile = event.target.result;

            // Get window.URL object
            var URL = window.URL || window.webkitURL;

            // Create and revoke ObjectURL
            deferred.resolve(URL.createObjectURL(imgFile));
        };
        return deferred.promise();
    }
    */

    function renderMedia(key, file) {
        jQuery('#' + options.sliderSelector).append(
            '<li><img src="data:' + file.type + ';base64,' + file.data + '" alt="' + file.fileName + '" /></li>'
        );
    }

    function initJcarousel() {
        /*
        var carousel = jQuery('.jcarousel').jcarousel(options.jcarouselOptions);
        jQuery('.jcarousel-control-prev').jcarouselControl({
            target: '-=1',
            carousel: carousel
        });
        jQuery('.jcarousel-control-next').jcarouselControl({
            target: '+=1',
            carousel: carousel
        });
        */
        var slider = new Slider('.jcarousel', {
            visibles: 2,
            controlNext: '.jcarousel-control-next',
            controlPrev: '.jcarousel-control-prev'
        });
        console.log('initialized carousel');
    }

    function iterateMedia() {
        var deferred = new jQuery.Deferred();
        // Open a transaction to the database
        var transaction = DB.transaction([options.storeName], 'readonly');
        var index = transaction.objectStore(options.storeName).index('fileName');

        var ctx = index.openCursor();
        ctx.onsuccess = function(event) {
            var cursor = event.target.result;
            if (cursor) {
                // cursor.key is a name, like "Bill", and cursor.value is the whole object.
                console.log("Name: " + cursor.key + ", size: " + cursor.value.size);
                renderMedia(cursor.key, cursor.value);
                cursor.continue();
            } else {
                // finished
                deferred.resolve();
            }
        };

        return deferred.promise();
    }

    function transformer(file, done) {
        console.debug('transforming', file);

        var reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onloadend = function (evt) {
            console.log('file loaded');
            /*
            var fileByteArray = [];
            if (evt.target.readyState === FileReader.DONE) {
                var arrayBuffer = evt.target.result,
                    array = new Uint8Array(arrayBuffer);
                for (var i = 0; i < array.length; i++) {
                    fileByteArray.push(array[i]);
                }
            }
            */
            var binary = '';
            var bytes = new Uint8Array( evt.target.result );
            var len = bytes.byteLength;
            for (var i = 0; i < len; i++) {
                binary += String.fromCharCode( bytes[ i ] );
            }
            var blob = {
                data: window.btoa( binary ),
                fileName: file.name,
                type: file.type,
                size: file.size
            };

            console.log('storing b64 data...');
            // get file data
            storeInDB(blob, file.name).then(function () {
                console.log('stored.');
                done();
            });

            console.log('adding data to div');
            renderMedia(file.name, blob)
        };
    }

    constructor();
}


$(document).ready(function() {
    mediaSlider(
        window,
        window.jQuery,
        window.Dropzone,
        {
            element: window.document.body,
            dropzoneSelector: 'mediaSliderDropzone',
            dbName: 'mediaSlider',
            storeName: 'media',
            sliderSelector: 'mediaSliderSlider',
            jcarouselOptions: {
                transitions: true
            }
        }
    );
});
