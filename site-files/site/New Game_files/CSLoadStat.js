CSLoadStat = {
    s: Math.random(),
    times: {},
    start: function (name) {
        try{
            CSLoadStat.times[name] = Date.now();
            CSEvent.push(
                "load_start",
                {s: CSLoadStat.s, time: Date.now(), port: CS_ENV.port},
                {name: name, map: CS_ENV.request_map}
            );
        }catch (e) {}
    },
    end: function (name) {
        try{
            if(name in CSLoadStat.times){
                var timeMs = Date.now() - CSLoadStat.times[name];
                console.log("Loading time %s", name, Math.round(timeMs / 10) / 100);
            }
            CSEvent.push(
                "load_end",
                {s: CSLoadStat.s, time: Date.now(), port: CS_ENV.port},
                {name: name, map: CS_ENV.request_map}
            );
        }catch (e) {}
    }
};