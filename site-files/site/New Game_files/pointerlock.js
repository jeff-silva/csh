(function (){
	function ge(id){
		return document.getElementById(id);
	};
	
	function on(elem, type, cb){
		return elem.addEventListener(type, cb, false);
	}
		
    var canvas_elem = ge( 'canvas' );
    var pointerlock_overlay = ge( 'pointerlock_overlay' );

    var havePointerLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
    if(!havePointerLock){
        canvas_elem.innerHTML = 'Your browser doesn\'t seem to support Pointer Lock API';
        return;
    }

    canvas_elem.requestPointerLock = canvas_elem.requestPointerLock || canvas_elem.mozRequestPointerLock || canvas_elem.webkitRequestPointerLock;

    on(pointerlock_overlay, 'click', function(){
		canvas_elem.requestPointerLock();
	});

    var pointerlockchange = function ( event ) {
        console.log('pointerlockchange');
    };
    
    var pointerlockerror = function ( event ) {
        canvas_elem.innerHTML = 'Pointer Lock API Error';
        return;
    };

    // Hook pointer lock state change events
    on(document, 'pointerlockchange', pointerlockchange, false );
    on(document, 'mozpointerlockchange', pointerlockchange, false );
    on(document, 'webkitpointerlockchange', pointerlockchange, false );
    on(document, 'pointerlockerror', pointerlockerror, false );
    on(document, 'mozpointerlockerror', pointerlockerror, false );
    on(document, 'webkitpointerlockerror', pointerlockerror, false );
})();
