saverWorker = new Worker('/js/saverWorker.js');

function cacheData(key, providerCB){
    var d = $.Deferred();

    localforage.getItem(key).then(function(v){
        if(v && v.length > 0){
            d.resolve(v);
        }else{
            providerCB(function(v){
                try{
                    if(v && v.length){
                        saverWorker.postMessage({
                            type: "save",
                            key: key,
                            v: v
                        });
                    }
                }catch(e){};
                //localforage.setItem(key, v);
                d.resolve(v);
            });
        }
    });

    return d;
}

function loadFSFromFile(FS, metafile, datafile, root, cb){

    console.log("loadFSFromFile: %s %s %s", metafile, datafile, root);

    function dirname(path) {
        return path.match( /.*\//)[0];
    }

    var metadatad = cacheData(metafile, function(cb){
        $.getJSON(metafile, cb);
    });

    var arrayBufferd = cacheData(datafile, function(cb){
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'arraybuffer';

        LoadMan.addDep(datafile, 1000000);
        xhr.open('GET', datafile, true);

        xhr.onprogress = function (event) {
            LoadMan.setTotal(datafile, event.total);
            LoadMan.setLoaded(datafile, event.loaded);
        };

        xhr.onload = function() {
            cb(xhr.response);
            LoadMan.setReady(datafile);
        };
        xhr.send(null);
    });

    return $.when(metadatad, arrayBufferd).then(function(metadata, arrayBuffer){
        var files = metadata.files;
        var byteArray = new Uint8Array(arrayBuffer);
        files.forEach(function(file, fileindex){
            setTimeout(function(){
                var filename = root + file.filename;
                var filedata = byteArray.slice(
                    file.start,
                    file.end
                );
                var dir = dirname(filename);

                try{
                    FS.createPath("/", dir, true, true);
                }catch (e){}

                try{
                    FS.createDataFile('/', filename, filedata, true, true, true);
                }catch (e){}

                if(cb && (fileindex == files.length - 1)) cb();
            }, 1);
        });
    });

}

var loadFileToFSLast = false;

function loadNamePretty(str)
{
    return str.split('?')[0].split('/').pop();
}

function loadFileToFS(from, to){
    to = to.split("?")[0];
    console.log("loadFileToFS: %s %s", from, to);

    var loadname = loadNamePretty(from);
    LoadMan.addDep(loadname, 100000);

    function dirname(path) {
        return path.match( /.*\//)[0];
    }

    function getD() {
        return cacheData(from, function (cb) {
            var fromURL;
            if (CS_ENV.skipCDN) {
                fromURL = from;
            } else {
                fromURL = "https://cdn." + CS_ENV.ORIGIN + from;
                // fromURL = "//cdn." + window.location.host.match(/[^\.]+.[^\.]+$/) + from;
            }

            function httpReq1() {
                var xhr = new XMLHttpRequest();
                fromURL = fromURL.indexOf("?") === -1 ? fromURL + ".pict" : fromURL.replace("?", ".pict?");
                xhr.open('GET', fromURL, true);
                xhr.responseType = 'arraybuffer';

                xhr.onerror = function () {
                    httpReq2();
                };

                xhr.onload = function () {
                    var byteArray = new Uint8Array(xhr.response);
                    cb(byteArray);
                };

                console.log("loadFileToFS HTTP req: %s %s", fromURL, to);
                xhr.send(null);
            }

            function httpReq2() {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', fromURL, true);
                xhr.responseType = 'arraybuffer';

                xhr.onerror = function () {
                    cb(null);
                };

                xhr.onload = function () {
                    var byteArray = new Uint8Array(xhr.response);
                    cb(byteArray);
                };

                console.log("loadFileToFS HTTP req: %s %s", fromURL, to);
                xhr.send(null);
            }

            httpReq1();
        });
    }

    var d = loadFileToFSLast ? $.when(loadFileToFSLast).then(getD, getD) : getD();
    loadFileToFSLast = d;
    // var d = getD();

    d.always(function () {
        LoadMan.setReady(loadname);
    });

    return $.when(d).then(function(byteArray){
        var dir = dirname(to);
        try{
            FS.createPath("/", dir, true, true);
        }catch (e){}
        FS.writeFile(to, byteArray, {encoding: "binary"});
    });
}

function loadFileToFS2(text, to){
    to = to.split("?")[0];
    console.log("loadFileToFS2: %s", to);

    function dirname(path) {
        return path.match( /.*\//)[0];
    }

    var dir = dirname(to);
    try{
        FS.createPath("/", dir, true, true);
    }catch (e){}
    FS.writeFile(to, text);
}

function FSOptimize() {
    FS.nodePermissions = function () {
        return 0;
    };
}