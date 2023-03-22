var LoadMan = {
		deps: {},
		minTotal: 0,
		progressCBs: []
};

LoadMan.addDep = function(name, total){
	LoadMan.deps[name] = {
		loaded: 0,
		total: total
	};
};

LoadMan.addFakeLoading = function(name, total, durationSec){
	var part = Math.round(total / durationSec);
	var loaded = 0;
	LoadMan.addDep(name, total);
	var timer = setInterval(function () {
		loaded += part;
		var ready = LoadMan.setLoaded(name, loaded);
		if(ready){
			clearInterval(timer);
		}
	}, durationSec * 1000);

};

LoadMan.triggerProgress = function(phrase){
	var percent = LoadMan.getPercent();
	LoadMan.progressCBs.forEach(function(cb){
		cb(percent, phrase);
	});
};

LoadMan.setLoaded = function(name, loaded){
	if(LoadMan.isComplete(name)){
		return;
	}
	if(loaded < LoadMan.deps[name].total){
		LoadMan.deps[name].loaded = loaded;
		LoadMan.triggerProgress();
		return false;
	}else{
		LoadMan.setReady(name);
		return true;
	}
};

LoadMan.setTotal = function(name, total){
	LoadMan.deps[name].total = total;
	LoadMan.triggerProgress("Loading: " + name);
};

LoadMan.setMinTotal = function(size){
	LoadMan.minTotal = size;
};

LoadMan.setReady = function(name){
	LoadMan.deps[name].loaded = LoadMan.deps[name].total;
	LoadMan.triggerProgress("Loaded: " + name);
};

LoadMan.isComplete = function(name){
	if(LoadMan.deps[name].total === 0){
		return false;
	}
	return LoadMan.deps[name].loaded >= LoadMan.deps[name].total;
};

LoadMan.getPercent = function(){
	var loaded = 0;
	var total = 0;
	$.each(LoadMan.deps, function(name, dep){
		loaded += dep.loaded;
		total += dep.total;
	});
	if(total < LoadMan.minTotal){
		total = LoadMan.minTotal;
	}
	var percent = Math.floor(loaded / total * 100);
	if(isNaN(percent)){
		return 0;
	}
	return percent;
};

LoadMan.setOnProgress = function(cb){
	LoadMan.progressCBs.push(cb);
};

LoadMan.setOnReady = function(cb){
	LoadMan.setOnProgress(function(percent){
		if(percent == 100){
			cb();
		};
	});
};
