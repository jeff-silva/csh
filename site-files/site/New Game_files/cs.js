var loadingLoaded = $(".loading-loaded");
var loadingPhrase = $(".loading-phase");
var chooseteam_cancel_enable = false;
var blockFamasMsg = false;
var spectator = false;
var full = false;

var engineReady = $.Deferred();
var chooseteamReady = $.Deferred();
var shaderSuccess = $.Deferred();
var cvarsReady = $.Deferred();
var processing_reload_button = false;
var processing_check_hud_ad = false;
var processing_check_room_players = false;
var processing_check_downloading = false;
var processing_server_query = false;

shaderSuccess.done(function () {
    $.when(preloadModels()).then(function(){
        console.log("Engine Ready");
        engineReady.resolve();
    });
});

CSLoadStat.start("main");
chooseteamReady.done(function () {
    CSLoadStat.end("main");
});

LoadMan.setOnProgress(function(percent, phrase){
    if(phrase){
        loadingPhrase.text(phrase);
    }

    loadingLoaded.css({
        width: percent + '%'
    });
});

// make BrowserFS to work on ES5 browsers
if (!ArrayBuffer['isView']) {
    ArrayBuffer.isView = function(a) {
        return a !== null && typeof(a) === "object" && a['buffer'] instanceof ArrayBuffer;
    };
}

function searchCB(text, phrase, cb){
    if(text && text.indexOf){
        if(text.indexOf(">say") !== -1){
            console.log("SAY:");
            console.log(text);
            return;
        }
        if(text.indexOf(phrase) !== -1){
            cb();
        }
    }
}

function rmdir(dir){
    try{
        var files = FS.readdir(dir);
        files.forEach(function(file){
            if(file[0] == '.')return;
            file = FS.joinPath([dir, file]);
            FS.unlink(file);
        });
    }catch(e){};
}

var inMenu = false;
var m_iPlayerNum = 0;

function getUrlVars() {
    var vars = window.location.href.split("/");
    return vars;
}

var server_data = {};
var blinking = true;
var controls_enabled = true;

function preloadModelFiles(){
    var ds = [];
    var models = [];
    try {
        models = $.merge(CS_ENV.modelList, CS_ENV.aPlayersModelList);
    } catch(e) {}
    models.forEach(function(modelName){
        var version = CS_ENV.MDL1_VERSION;
        if (typeof CS_ENV.fileListUpdate[modelName] !== "undefined") {
            version = CS_ENV.fileListUpdate[modelName];
        }
        ds.push(
            loadFileToFS(CS_ENV.resources_dir_players + modelName + '?v=' + version, "/rodir/cstrike/" + modelName)
        );
    });
    CS_ENV.modelListWeapon.forEach(function(modelName){
        var version = CS_ENV.MDL1_VERSION;
        var modelPath = modelName.split("/");
        var modelFileName = modelPath[modelPath.length - 1];
        if (typeof CS_ENV.fileListUpdate[modelName] !== "undefined") {
            version = CS_ENV.fileListUpdate[modelName];
        }
        ds.push(
            loadFileToFS(CS_ENV.resources_dir_weapons + modelName + '?v=' + version, "/rodir/cstrike/models/" + modelFileName)
        );
    });
    // gfx and decals
    ds.push(
        loadFileToFS("/rez/decals.wad?v=" + CS_ENV.DECALS_WAD_VERSION, "/rodir/cstrike/decals.wad")
    );
    ds.push(
        loadFileToFS("/rez/gfx.wad?v=" + CS_ENV.GFX_WAD_VERSION, "/rodir/cstrike/gfx.wad")
    );

    return $.when.apply($, ds);
}

function preloadSoundFiles(){
    var ds = [];
    CS_ENV.soundList.forEach(function(sound){
        var version = CS_ENV.SND1_VERSION;
        if (typeof CS_ENV.fileListUpdate[sound] !== "undefined") {
            version = CS_ENV.fileListUpdate[sound];
        }
        ds.push(
            loadFileToFS(CS_ENV.resources_dir_sounds + "sound/" + sound + '?v=' + version, "/rodir/valve/" + sound)
        );
    });
    ds.push(
        loadFileToFS(CS_ENV.resources_dir + "sound/materials.txt?v=" + CS_ENV.materials_txt_version, "/rodir/cstrike/sound/materials.txt")
    );
    ds.push(
        loadFileToFS(CS_ENV.resources_dir + "sound/sentences.txt?v=" + CS_ENV.sentences_txt_version, "/rodir/cstrike/sound/sentences.txt")
    );
    return $.when.apply($, ds);
}

preloadModelsReady = false;
function preloadModels(){
    if(preloadModelsReady){
        return true;
    }
    var d = $.Deferred();
    CS_ENV.modelList.forEach(function(modelName, index){
        setTimeout(function(){
            var mp = Module.Mod_FindName(modelName, 1);
            Module.Mod_LoadModel(mp, 0);
            if(index == CS_ENV.modelList.length -1){
                preloadModelsReady = true;
                d.resolve();
            }
        }, 1);
    });
    return d;
}

function str2u8arr(str) {
    var buf = new ArrayBuffer(str.length);
    var bufView = new Uint8Array(buf);
    for (var i=0, strLen=str.length; i<strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return bufView;
}

function preloadMapFiles(mapName, list){
    var ds = [];
    list.forEach(function(file){
        var version = CS_ENV.MAPFILES_VERSION;
        if (typeof CS_ENV.fileListUpdate[file] !== "undefined") {
            version = CS_ENV.fileListUpdate[file];
        }
        ds.push(
            loadFileToFS("/rez/" + file + "?v=" + version, "/rodir/cstrike/" + file)
        );
    });
    return $.when.apply($, ds);
}

function OnServerMessage(info) {
    var colors = {
        'black': 'rgba(0, 0, 0, 0.4)',
        'blue': 'rgba(0, 92, 128, 0.4)',
        'red': 'rgba(128, 0, 0, 0.4)',
        'green': 'rgba(0, 128, 39, 0.4)'
    };
    var color = info.split(" ")[0];
    var colorRegex = new RegExp(color, '');
    var string = info.replace(colorRegex, '');
    var hudmessage = $(".hud-server-message");
    hudmessage.html(null);
    clearTimeout(OnServerMessageTimeout);
    hudmessage.html(string);
    hudmessage.css('background', colors[color]);
    hudmessage.css('display', 'block');
    OnServerMessageTimeout = setTimeout(function(){
        hudmessage.fadeOut(1000, function() { hudmessage.html(null); });
    }, 5000);
}

var cvars;

var playerFrags = {};
var playerDeaths = {};
var playerStatus = {};
var playerTeams = {};
var currentMoney = 800;
var money_el = $(".hud-money")
var timer_sec = 0;

function updateScoreBoard(){
    var trhead = $(".scoreboard-hud-tr-head");
    var trbody = $(".scoreboard-hud-tr-body");

    var tr_live_block = $(".hud-t-live-block");

    var cthead = $(".scoreboard-hud-ct-head");
    var ctbody = $(".scoreboard-hud-ct-body");

    var ct_live_block = $(".hud-ct-live-block");

    var commonhead = $(".scoreboard-hud-common-head");

    var t_list = $(".t-list");
    var ct_list = $(".ct-list");

    var t_count = $("#chooseteam-menu .chooseteam-menu-buttons .chooseteam-menu-button-tr .menu-button-text .plrs-tr");
    var ct_count = $("#chooseteam-menu .chooseteam-menu-buttons .chooseteam-menu-button-ct .menu-button-text .plrs-ct");

    trbody.html('');
    ctbody.html('');

    tr_live_block.html('');
    ct_live_block.html('');

    t_list.html('');
    ct_list.html('');

    t_count.html('0');
    ct_count.html('0');

    var trtotal = [0, 0];
    var cttotal = [0, 0];

    var players = [];
    var skill_total = {
        1: 0,
        2: 0
    }
    var players_total = {
        1: 0,
        2: 0
    }
    var team_skill = {
        1: 0,
        2: 0
    }
    try {
        $.each(g_PlayerExtraInfo, function (id, player) {
            if (typeof(g_TeamInfo[player.id]) !== undefined) {
                players.push({
                    id: id,
                    rank: player.frags*1
                });
            }
        });

        players.sort( function compare( a, b ) {
            if ( a.rank > b.rank ){
                return -1;
            }
            if ( a.rank < b.rank ){
                return 1;
            }
            return 0;
        });

        var tr_rank = 0;
        var ct_rank = 0;
        $.each(players, function (dummy, player) {
            var style="";
            var id = player.id;
            var memberInfo = g_PlayerExtraInfo[id];
            var me = false;
            if (memberInfo.teamnumber !== "undefined" && memberInfo.skill != '-') {
                skill_total[memberInfo.teamnumber] += memberInfo.skill;
                players_total[memberInfo.teamnumber]++;
            }
            if(!memberInfo.name){return;}
            if (id == CS_ENV.myXashId) {
                style="style='background-color: #4d9a46;'";
                me = true;
            }
            if (memberInfo.status==='Dead') {
                if (id != CS_ENV.myXashId) style="style='background-color: #505050;'"
                else style="style='background-color: #547b50;'"
            }
            if (memberInfo.rank == 0) {
                memberInfo.rank = "Newbie";
            }
            var tr = $("<tr>");
            var td;
            if (!memberInfo.level || memberInfo.level == 0) {
                memberInfo.level = '';
            }
            td = $("<td "+style+">");
            td.text(memberInfo.level);
            tr.append(td);

            td = $("<td "+style+">");
            td.html('<div class="player_rank">['+memberInfo.rank+']</div> ');

            if (memberInfo.premium) {
                var name_string = $("<span style=\"color: #fff81d;\">" + memberInfo.name + " </span>");
            } else {
                var name_string = $("<span style=\"color: #ffffff;\">" + memberInfo.name + " </span>");
            }
            td.append(name_string);

            if (memberInfo.country != "xx") {
                var span = $("<span class=\"flag-icon flag-icon-"+memberInfo.country+"\" style=\"margin-right: 3px; border-radius: 3px;\"></span>");
                td.append(span);
            }
            if (typeof g_PlayerVoiceDisabled[id] !== "undefined" || (me == true && CS_ENV.voice == 0)) {
                var span = $("<i class=\"fa fa-microphone-slash\" aria-hidden=\"true\" style=\"color: #ff8b7d;\"></i>");
                td.append(span);
            }

            tr.append(td);

            td = $("<td "+style+">");
            var text = "";
            if (Object.keys(memberInfo.perks).length > 0
                // BR TEMPORARY
                && !CS_ENV.request_map.match(/^br_/)
            ) {
                var skip = false;
                Object.keys(memberInfo.perks).forEach(function (key) {
                    var perk = memberInfo.perks[key];
                    skip = false;
                    if (CS_ENV.perks_info[perk].team_limit > 0) {
                        if (memberInfo.teamnumber != CS_ENV.perks_info[perk].team_limit) {
                            skip = true;
                        }
                    }
                    if (!skip) {
                        text += CS_ENV.perks_info[perk].perk_icon + " ";
                    }
                });
            } else {
                text = "-";
            }
            td.append(text.trim());
            tr.append(td);

            td = $("<td "+style+">");
            td.text(memberInfo.frags);
            tr.append(td);

            td = $("<td "+style+">");
            td.text(memberInfo.deaths);
            tr.append(td);

            td = $("<td "+style+">");
            td.text(memberInfo.skill);
            tr.append(td);

            if (!memberInfo.ping || memberInfo.ping == 0) {
                memberInfo.ping = '-';
            }
            td = $("<td "+style+">");
            td.text(memberInfo.ping);
            tr.append(td);

            td = $("<td "+style+">");
            td.text(memberInfo.status);
            tr.append(td);

            var team_icon = $("<div style='height: 30px; width: 30px; background-size: cover;'>");
            team_icon.css('display', 'inline-block');

            var plr_name = $("<span>");
            plr_name.text(memberInfo.name);

            if (memberInfo.status==='Dead') {
                team_icon.css('filter','grayscale(100%');
            }

            var teamnumber = memberInfo.teamnumber;
            if(teamnumber === TEAM_TERRORIST){
                trbody.append(tr);
                team_icon.css('background-image', 'url(/img/ter-t.png)');
                team_icon.css('float','left');
                tr_live_block.append(team_icon);
                t_list.append(plr_name);
                t_list.append($("<br>"));
                t_count.text((parseInt(t_count.text()) + parseInt('1'))+'');
            }else if(teamnumber === TEAM_CT) {
                ctbody.append(tr);
                team_icon.css('background-image', 'url(/img/ct-t.png)');
                team_icon.css('float','right');
                ct_live_block.append(team_icon);
                ct_list.append(plr_name);
                ct_list.append($("<br>"));
                ct_count.text((parseInt(ct_count.text()) + parseInt('1'))+'');
            }
        });
        Object.keys(skill_total).forEach(function(teamnumber) {
            if (skill_total[teamnumber] > 0) {
                var skill_avg = Math.round(skill_total[teamnumber] / players_total[teamnumber]);
                $('#skill_total_'+teamnumber).text(skill_avg);

            } else {
                $('#skill_total_'+teamnumber).text('-')
            }
        });

        cthead.insertAfter(commonhead);
        ctbody.insertAfter(cthead);
        trhead.insertAfter(ctbody);
        trbody.insertAfter(trhead);
    }catch(e){
        console.error(e);
    }
}

function getPlayerScoreTR(id) {
    id = '#scoreboard-row-' + id;
    return $(id);
}

var weaponToLetter = {
    "p228": 'c',
    "shield": '',
    "scout": 'n',
    "hegrenade": 'h',
    "grenade": 'h',
    "xm1014": '',
    "c4": '',
    "mac10": '',
    "aug": 'e',
    "smokegrenade": 'h',
    "elite": '',
    "fiveseven":'c',
    "ump45":'',
    "sg550":'A',
    "galil":'v',
    "famas":'t',
    "usp":'c',
    "glock18":'c',
    "awp":'r',
    "mp5navy":'x',
    "m249":'',
    "m3":'',
    "m4a1":'w',
    "tmp":'',
    "g3sg1":'',
    "flashbang":'',
    "deagle":'f',
    "sg552":'A',
    "ak47":'b',
    "knife":'j',
    "p90": ''
};

var weaponIdToLetterHud = [
    "",
    "y",
    "",
    "n",
    "h",
    "B",
    "C",
    "l",
    "e",
    "g",
    "s",
    "u",
    "q",
    "o",
    "v",
    "t",
    "a",
    "c",
    "r",
    "x",
    "z",
    "k",
    "w",
    "d",
    "i",
    "p",
    "f",
    "A",
    "b",
    "j",
    "m",
];

var weaponIdToAlias = [
    "",
    "weapon_p228",
    "",
    "weapon_scout",
    "weapon_hegrenade",
    "weapon_xm1014",
    "weapon_c4",
    "weapon_mac10",
    "weapon_aug",
    "weapon_smokegrenade",
    "weapon_elite",
    "weapon_fiveseven",
    "weapon_ump45",
    "weapon_sg550",
    "weapon_galil",
    "weapon_famas",
    "weapon_usp",
    "weapon_glock18",
    "weapon_awp",
    "weapon_mp5navy",
    "weapon_m249",
    "weapon_m3",
    "weapon_m4a1",
    "weapon_tmp",
    "weapon_g3sg1",
    "weapon_flashbang",
    "weapon_deagle",
    "weapon_sg552",
    "weapon_ak47",
    "weapon_knife",
    "weapon_p90"
];

function showMenu(menuName){
    inMenu = true;
    setTimeout(function(){
        exitPointerlock();
    }, 10);
    $('#' + menuName + '-menu').show();
}

var InBuy = false;
var MyId = -1;
var myTeamIndex = 0;
function getMyTeamIndex(){
    try{
        return CS_ENV.myXashId in g_PlayerExtraInfo ? g_PlayerExtraInfo[CS_ENV.myXashId].teamnumber : 0;
    }catch (e) {
        return 0;
    }
}

function getMyTeamName(){
    var index = getMyTeamIndex();
    if(index == 1)return 't';
    if(index == 2)return 'ct';
    return 'spec';
}

function logHookMsg(){
    console.log(arguments);
}

function logHookMsg2(name){
    return function () {
        // console.log(name);
        // console.log(arguments);
    }
}

var ammoX = {};

var C4timer = '';
var OnServerMessageTimeout = '';

RoundTimeInter = 0;
var bomb_blinking = false;
var bomb_blinking_interval = '';
var bomb_blinking_color = 'green';

var MAX_WEAPONS = 32;
var MAX_WEAPON_POSITIONS = 19;
var MAX_WEAPON_SLOTS = 5;
currWeaponList = [];
function initCurrWeaponList() {
    for(var i = 0; i <= MAX_WEAPON_SLOTS; i++){
        currWeaponList[i] = [];
        for(var j = 0; j <= MAX_WEAPON_POSITIONS; j++){
            currWeaponList[i][j] = null;
        }
    }
}
initCurrWeaponList();

var currWeaponId = -1;
var currSlotNum = -1;
var weaponBlockedFlag = true;
function drawWeapons() {
    var hud_weapons = $(".hud-weapons");
    hud_weapons.html('');
    var weaponId;
    for(var slotNum = 0; slotNum <= MAX_WEAPON_SLOTS; slotNum++){
        for(var j = 0; j <= MAX_WEAPON_POSITIONS; j++){
            weaponId = currWeaponList[slotNum][j];
            if(weaponId != null){
                var letter = weaponIdToLetterHud[weaponId];
                var weapon_elem = $('<div class="hud-weapon">' + letter + '<span>' + (slotNum + 1) + '</span></div>');
                if(weaponId === currWeaponId){
                    weapon_elem.addClass("hud-grad-right");
                    currSlotNum = slotNum;
                }
                if(letter === "h") {
                    weapon_elem.addClass("hud-grenade-he");
                }
                if(letter === "p") {
                    weapon_elem.addClass("hud-grenade-fl");
                }
                if(letter === "g") {
                    weapon_elem.addClass("hud-grenade-sm");
                }
                weapon_elem.appendTo(hud_weapons);
                console.log(weapon_elem);
            }
        }
    }
}

var g_PlayerExtraInfo = {};
var g_TeamInfo = {};
var g_PlayerVoiceDisabled = {};
var g_PlayerNamesInfo = {};

function rad2deg (angle) {
    return angle * 57.29577951308232;
}
function deg2rad (angle) {
    return angle * 0.017453292519943295;
}
function vector_length(x, y) {
    return Math.sqrt(x*x + y*y);
}

radarPoints = [];
myAngle = 0;
c4Drop = false;
var MAX_RADIUS = 62;
radarDx = [];
radarTimers = [];
$(function () {
    radarPoints = $(".hud-radar-point");
});

setInterval(function () {
    radarPoints.hide();
    var angle = myAngle;
    $.each(radarDx, function (num, info) {
        if(!info)return;

        var dx = info[0];
        var dy = info[1];
        var color = {3: "red", 2: "red", 1: "white"};
        color = color[info[2]];


        if( dx === 0 )dx = 0.00001;
        if( dy === 0 )dy = 0.00001;

        var flOffset = deg2rad( angle - rad2deg( Math.atan2(dy, dx)));
        var iRadius = Math.min( vector_length(dx, dy) / 32, MAX_RADIUS);

        var rx = (iRadius * Math.sin(flOffset));
        var ry = (iRadius * -Math.cos(flOffset));

        rx += MAX_RADIUS;
        ry += MAX_RADIUS;

        // var rx = (myPos[0] - x) + 733;
        // var ry = (myPos[1] - y) + 733;
        radarPoints.eq(num).show().css({
            top: ry,
            left: rx,
            backgroundColor: color
        });
    });
}, 100);

var Module = {
    TOTAL_MEMORY: CS_ENV.memory * 1024 * 1024,
    preRun: [],
    postRun: [],

    _EnableIconJS: function (ShouldEnable, iconPtr, r, g, b) {
        var icon = Pointer_stringify(iconPtr);
        console.log("_EnableIconJS", arguments, icon);
        if (icon == 'c4') {
            bomb_blinking = bomb_blinking ? false : true;
            $(".hud-" + icon + "-icon").show();
        } else {
            $(".hud-" + icon + "-icon").css({
                color: 'rgb(' + [r, g, b].join(',') + ')'
            }).show();
        }
        if (icon == 'buyzone') {
            bomb_blinking = false;
            InBuy = true;
        }
        if (bomb_blinking) {
            bomb_blinking_interval = setInterval(function(){
                if (bomb_blinking_color == 'green') {
                    bomb_blinking_color = 'red';
                    $('.hud-c4-icon').css('color', '#ff6a00');
                } else {
                    bomb_blinking_color = 'green';
                    $('.hud-c4-icon').css('color', '#00ff00');
                }
            }, 500);
        } else {
            clearInterval(bomb_blinking_interval);
            $('.hud-c4-icon').css('color', '#00ff00');
        }
    },
    _DisableIconJS: function (iconPtr, r, g, b) {
        var icon = Pointer_stringify(iconPtr);
        console.log("_DisableIconJS", arguments, icon);
        $(".hud-" + icon + "-icon").hide();
        if (icon == 'buyzone') {
            InBuy = false;
        }
    },
    _ChangeTeamJS: function(team){
        if(team == 256){
            myTeamIndex = TEAM_TERRORIST;
        }else if(team == 512){
            myTeamIndex = TEAM_CT;
        }else {
            myTeamIndex = TEAM_UNASSIGNED;
        }
    },
    _BuyCloseJS: function(){
        try{
            BuyCloseJS();
        }catch (e) {}
    },

    _ClientPrintJSDict: {
        C4_Plant_At_Bomb_Spot: "C4 must be planted at a bomb site!",
        C4_Plant_Must_Be_On_Ground: "You must be standing on the ground to plant the C4!",
        C4_Arming_Cancelled: "Arming Sequence Canceled. C4 can only be placed at a Bomb Target.",
        Switch_To_FullAuto: "Switched to Automatic mode",
        Switch_To_BurstFire: "Switched to Burst-Fire mode",
        Switch_To_SemiAuto: "Switched to Semi-Automatic mode",
    },

    _SetPlayerNumJS: function(num){
        m_iPlayerNum = num;
    },

    _MsgFunc_BombDropJS: function(x, y, z, flag){
        if(flag){
            var msg = "The bomb has been planted!";
            $(".hud-message").text(msg).show();
            setTimeout(function(){
                $(".hud-message").text('').hide();
            }, 1000);
        }
    },

    _ClientPrintJS: function(msgPtr){
        var msg = Pointer_stringify(msgPtr);
        msg = msg.substr(1);
        if(blockFamasMsg && (msg === "Switch_To_BurstFire" || msg === "Switch_To_FullAuto")){
            return;
        }
        if(msg in Module._ClientPrintJSDict){
            msg = Module._ClientPrintJSDict[msg];
        }
        $(".hud-message").text(msg).show();
        setTimeout(function(){
            $(".hud-message").text('').hide();
        }, 1000);
    },

    _MsgFunc_StatusTextJS: logHookMsg2("StatusTextJS"),
    _MsgFunc_StatusValueJS: function(index, val){
        if(spectator || index !== 2){
            return;
        }
        val = Math.round((val - 2) / 256);
        var statusbar = $(".hud-statusbar");
        statusbar.text('');

        if(val === 0){
            return;
        }

        $.each(g_PlayerExtraInfo, function (dummy, player) {
            if (player.id != val){
                return;
            }
            statusbar.removeClass('tr-color ct-color');
            var teamnumber = player.teamnumber;
            if(teamnumber == TEAM_TERRORIST){
                statusbar.addClass('tr-color');
            }else if(teamnumber == TEAM_CT) {
                statusbar.addClass('ct-color');
            }

            var text = getMyTeamIndex() == teamnumber ? "Friend: " : "Enemy: ";
            text += player.name;
            statusbar.text(text);
        });

        console.log("StatusValueJS:", val);
    },
    _MsgFunc_SendAudioJS: logHookMsg2("SendAudioJS"),
    _BroadcastJS: logHookMsg2("BroadcastJS"),
    _MsgFunc_ReloadSoundJS: logHookMsg2("ReloadSoundJS"),
    _MsgFunc_BotVoiceJS: logHookMsg2("BotVoiceJS"),
    _MsgFunc_RadarJS: logHookMsg2("RadarJS"),
    _MsgFunc_HostageKJS: logHookMsg2("HostageKJS"),
    _MsgFunc_HostagePosJS: logHookMsg2("HostagePosJS"),
    _MsgFunc_BombPickupJS: logHookMsg2("BombPickupJS"),
    _MsgFunc_StatusIconJS: logHookMsg2("StatusIconJS"),
    _MsgFunc_ScoreInfoJS: logHookMsg2("ScoreInfoJS"),
    _MsgFunc_TeamScoreJS: logHookMsg2("TeamScoreJS"),
    _MsgFunc_TeamInfoJS: logHookMsg2("TeamInfoJS"),

    _DrawZAxisJS2: function(angle){
        myAngle = angle;
    },

    _MsgFunc_HealthJS: function(health){
        console.log("_MsgFunc_HealthJS");
        console.log(health);
        var currHealth = $(".hud-val", ".hud-health").text() * 1;
        console.log(currHealth );
        if(currHealth === 0){
            Module.setSpecMode(true);
        }
        var health_color;
        if (health >= 75) health_color = "#79dc0d";
        else if (health < 75 && health >= 26) health_color = "#ffb100";
        else health_color = "#ff5717";
        $(".hud-val", ".hud-health").text(health).css({color: health_color});
        if(health == 0){
            Module.setSpecMode(true);
        }
    },
    _MsgFunc_DamageJS: logHookMsg2("DamageJS"),
    // _MsgFunc_ScoreAttribJS: logHookMsg2("ScoreAttribJS"),
    _MsgFunc_ScoreAttribJS: function (PlayerID, Flags) {
        // removed
    },
    _MsgFunc_ClCorpseJS: logHookMsg2("ClCorpseJS"),
    _MsgFunc_FlashlightJS: logHookMsg2("FlashlightJS"),
    _MsgFunc_FlashBatJS: logHookMsg2("FlashBatJS"),
    _MsgFunc_ReceiveWJS: logHookMsg2("ReceiveWJS"),
    _MsgFunc_LogoJS: logHookMsg2("LogoJS"),
    _MsgFunc_ResetHUDJS: logHookMsg2("ResetHUDJS"),
    _MsgFunc_GameModeJS: logHookMsg2("GameModeJS"),
    _MsgFunc_InitHUDJS: logHookMsg2("InitHUD"),
    _MsgFunc_ViewModeJS: logHookMsg2("ViewModeJS"),
    _MsgFunc_SetFOVJS: logHookMsg2("SetFOVJS"),
    _MsgFunc_ConcussJS: logHookMsg2("ConcussJS"),
    _MsgFunc_ADStopJS: logHookMsg2("ADStopJS"),
    _MsgFunc_ItemStatusJS: logHookMsg2("ItemStatusJS"),
    _MsgFunc_ReqStateJS: logHookMsg2("ReqStateJS"),
    _MsgFunc_ForceCamJS: logHookMsg2("ForceCamJS"),
    _MsgFunc_SpectatorJS: logHookMsg2("SpectatorJS"),
    _MsgFunc_ServerNameJS: logHookMsg2("ServerNameJS"),
    _MsgFunc_ShadowIdxJS: logHookMsg2("ShadowIdxJS"),
    _MsgFunc_DeathMsgJS: function(killer, victim, headshot, truncatedWeaponNamePtr){
        console.log('_MsgFunc_DeathMsgJS');
        try{
            console.log('_MsgFunc_DeathMsgJS '+killer+' '+victim);
            if (g_TeamInfo[victim].name !== '[g7V214B51A51D8B]') {
                var div_death = $("<div class='hud-death'>");
                var div_victim = $("<div class='hud-death-victim'>");
                div_victim.text(g_TeamInfo[victim].name);
                div_victim.addClass(g_TeamInfo[victim].teamnumber == TEAM_CT ? 'ct-color' : 'tr-color');
                div_death.append(div_victim);
                if(headshot){
                    var div_head = $("<div class='hud-death-head'>D</div>");
                    div_death.append(div_head);
                }
                var wLetter;
                if(killer === victim){
                    wLetter = 'C';
                }else{
                    var truncatedWeaponName = Pointer_stringify(truncatedWeaponNamePtr);
                    truncatedWeaponName = truncatedWeaponName.replace(/^d_/, '');
                    if(truncatedWeaponName.indexOf("grenade") === -1){
                        truncatedWeaponName = "weapon_" + truncatedWeaponName;
                    }else {
                        truncatedWeaponName = "weapon_hegrenade";
                    }
                    var weaponId = weaponIdToAlias.indexOf(truncatedWeaponName);
                    wLetter = weaponIdToLetterHud[weaponId];
                }
                var div_weapon = $('<div class="hud-death-weapon">');
                div_weapon.text(wLetter);
                div_death.append(div_weapon);
                if(killer !== victim){
                    var div_killer = $("<div class='hud-death-killer'>");
                    div_killer.text(g_TeamInfo[killer].name);
                    div_killer.addClass(g_TeamInfo[killer].teamnumber == TEAM_CT ? 'ct-color' : 'tr-color');
                    div_death.append(div_killer);
                }
                var dwrap = $("<div>");
                dwrap.append(div_death);
                $(".hud-deaths").append(dwrap);
                setTimeout(function(){
                    dwrap.remove();
                }, 5000);
                console.log('_MsgFunc_DeathMsgJS '+killer+' '+victim);
                updateScoreBoard();
            }
        }catch (e) {
            console.error(e);
        }
    },

    _PickupWeaponJS: function(iId, iSlot, iSlotPos){
        console.log("_PickupWeaponJS", iId, iSlot, iSlotPos);
        currWeaponList[iSlot][iSlotPos] = iId;
        drawWeapons();
    },
    _DropWeaponJS: function(iId, iSlot, iSlotPos){
        console.log("_DropWeaponJS", iId, iSlot, iSlotPos);
        currWeaponList[iSlot][iSlotPos] = null;
        drawWeapons();
    },

    _TeamInfoJS: function(cl, teamnumber, frags, deaths, namePtr){
        // if(cl == 1){
        //     g_TeamInfo = {};
        // }
        var name = Pointer_stringify(namePtr);
        g_TeamInfo[cl] = g_TeamInfo[cl] || {};
        g_TeamInfo[cl].teamnumber = teamnumber;
        g_TeamInfo[cl].frags = frags;
        g_TeamInfo[cl].deaths = deaths;
        g_TeamInfo[cl].name = name;
        // if(!(g_TeamInfo[cl].status)){
        //     g_TeamInfo[cl].status = '';
        // }
        //updateScoreBoard();
    },

    _MsgFunc_CurWeaponJS: function(iState, iId, iClip, iCount){
        if(iState == 0){
            return;
        }
        if(iClip === -1){
            $(".hud-ammo").hide();
        }else {
            $(".hud-ammo").show();
            $(".hud-ammo-magazine").text(iClip);
            $(".hud-ammo-rest").text(iCount);
        }
        currWeaponId = iId;
        if([3, 13, 18, 24].indexOf(iId) === -1){
            $(".hud-crosshair").show();
        }else{
            $(".hud-crosshair").hide();
        }
        if([8, 27].indexOf(iId) !== -1){
            $(".hud-zoom-overlay").hide();
        }
        drawWeapons();
        if(weaponBlockedFlag){
            Module.pfnClientCmd("slot" + (currSlotNum +1));
            weaponBlockedFlag = false;
        }
        // console.log("curweapon", iState, iId, iClip, iCount);
    },
    _MsgFunc_CurWeaponAmmoJS: function(iCount){
        $(".hud-ammo-rest").text(iCount);
    },
    _MsgFunc_SetFOVJS: function(fov){
        if(fov == 90){
            $(".hud-zoom-overlay").hide();
        }else{
            $(".hud-zoom-overlay").show();
        }
        console.log("MsgFunc_SetFOVJS");
        console.log(fov);
    },
    _ChangeFOVJS: function(fov){
        console.log("_ChangeFOVJS");
        console.log(fov);
    },
    _MsgFunc_WeaponListJS: logHookMsg2("_MsgFunc_WeaponListJS"),
    _MsgFunc_AmmoPickupJS: logHookMsg2("_MsgFunc_AmmoPickupJS"),
    _MsgFunc_WeapPickupJS: function (id) {

    },
    _MsgFunc_ItemPickupJS: logHookMsg2("ItemPickupJS"),
    _MsgFunc_HideWeaponJS: function (i1) {
        console.log(i1);
    },
    _MsgFunc_AmmoXJS: function (ammoType, val) {
        ammoX[ammoType] = val;
    },
    _MsgFunc_CrosshairJS: function (draw) {
        console.log("_MsgFunc_CrosshairJS", draw);
        //if(draw){
        //    $(".hud-crosshair").show();
        //}else {
        //    $(".hud-crosshair").hide();
        //}
    },

    setSpecMode: function(spec){
        $(".hud-statusbar").text('');
        if(spec){
            spectator = true;
            $(".hud-container").addClass("hud-spectator");
        }else{
            spectator = false;
            $(".hud-container").removeClass("hud-spectator");
        }
    },

    _MsgFunc_BrassJS: logHookMsg2("BrassJS"),
    _MsgFunc_SpecHealthJS: logHookMsg2("SpecHealthJS"),
    _MsgFunc_TrainJS: logHookMsg2("TrainJS"),
    _MsgFunc_TextMsgJS: logHookMsg2("TextMsgJS"),
    /**
     * Menu convert
     \w : White text (this is the default)
     \d : Dim (gray) text
     \y : Yellow text
     \r : Red text
     \R : Right-align (just for the remainder of the current line)
     **/
    menuStrToText: function(str){
        str = str.replace(/\\w|\\d|\\y|\\r|\\g|\\R/g, ' ');
        str = str
            .split("\n")
            .map(function(elem){
                return elem.trim();
            })
            .join("\n");
        return str;
    },
    menuStrToHTML: function(str){
        var arr = str.split(/(\\w|\\d|\\y|\\r|\\g|\\R|\n)/g);
        var mode = ["white"];
        var arr2 = [];
        console.log(arr);
        arr.forEach(function (part) {
            switch (part) {
                case "\\w":
                    mode.push("white");
                    break;
                case "\n":
                    mode = ["white"];//reset
                    arr2.push(["\n"]);
                    break;
                case "\\d":
                    mode.push("dim");
                    break;
                case "\\y":
                    mode.push("yellow");
                    break;
                case "\\r":
                    mode.push("red");
                    break;
                case "\\g":
                    mode.push("green");
                    break;
                case "\\R":
                    mode.push("right");
                    break;
                default:
                    arr2.push([mode.slice(), part]);
            }
        });
        var container = $("<div>");
        arr2.forEach(function (part2) {
            var mode = part2[0];
            if(mode === "\n"){
                container.append($("<i>"));
                return;
            }
            var text = part2[1];
            mode = mode.filter(function uniq(value, index, self) {
                return self.indexOf(value) === index;
            });
            var classes = mode.map(function (part) {
                return "hud-menu-mode-" + part;
            });
            var res = $("<span>");
            res.addClass(classes.join(" "));
            res.text(text);
            container.append(res);
        });
        return container.html();
    },
    hudMenuVisible: function(){
        var div = $(".hud-menu-text");
        return div.is(":visible") && div.text().trim() !== '';
    },
    hudMenuContains: function(text){
        return $(".hud-menu-text:contains('" + text + "')").length > 0;
    },
    hudMenuClose: function(){
        var div = $(".hud-menu-text");
        Module.menuStr = "";
        div.hide();
    },
    menuStr: "",
    _MsgFunc_ShowMenuJS: function(m_bitsValidSlots, DisplayTime, NeedMore, menustringPtr){
        var div = $(".hud-menu-text");

        var menustring = Pointer_stringify(menustringPtr);
        Module.menuStr += menustring;

        function closeMenu(){
            Module.menuStr = "";
            div.hide();
        }

        function openMenu() {
            div.show();
        }

        if(!m_bitsValidSlots){
            return Module.hudMenuClose();
        }

        if(NeedMore){
            return;
        }
        // var text = Module.menuStrToText(Module.menuStr);
        var html = Module.menuStrToHTML(Module.menuStr);
        Module.menuStr = "";
        console.log("_MsgFunc_ShowMenuJS");
        console.log(m_bitsValidSlots, DisplayTime, NeedMore, menustring);

        // div.text(text);
        div.html(html);
        openMenu();
        // div.css({
        //     top: Math.round(screen.height / 2 - div.height() / 2)
        // });
        if(DisplayTime > 0){
            setTimeout(
                function(){Module.hudMenuClose();},
                DisplayTime*1000
            );
        }
    },
    _MsgFunc_VGUIMenuJS: logHookMsg2("VGUIMenuJS"),
    _MsgFunc_BuyCloseJS: logHookMsg2("BuyCloseJS"),
    _MsgFunc_AllowSpecJS: logHookMsg2("AllowSpecJS"),
    _MsgFunc_SpecHealthJS: function (health, client) {
        // logHookMsg2("_MsgFunc_SpecHealthJS")(arguments);
        // Module.setSpecMode(true);
        Module._MsgFunc_SpecHealth2JS(health, client);
    },
    _MsgFunc_SpecHealth2JS: function (health, client, g_iUser2) {
        try{
            var text = health > 0 ? g_TeamInfo[client].name + "(" + health + ")" : "";
            var team = g_TeamInfo[client].teamnumber;
            var nameblock = $(".hud-spec-name");
            nameblock
                .removeClass("ct-color")
                .removeClass("tr-color");
            if(team == TEAM_CT){
                nameblock.addClass('ct-color');
            }else{
                nameblock.addClass('tr-color');
            }
            nameblock.text(text);
            // logHookMsg2("_MsgFunc_SpecHealth2JS")(arguments);
            Module.setSpecMode(true);
        }catch (e) {
            console.error(e);
        }
    },

    _UserCmd_ToggleSpectatorMenuJS:logHookMsg2("_UserCmd_ToggleSpectatorMenuJS"),
    _CHudSpectatorGuiResetJS:logHookMsg2("_CHudSpectatorGuiResetJS"),
    _SetSpectatorStartPositionJS:logHookMsg2("SetSpectatorStartPositionJS"),

    _MsgFunc_RoundTimeJS: function (m_iTime, m_fStartTime, m_flTime) {
        timer_sec = m_iTime + m_fStartTime - m_flTime;
        var seconds = timer_sec % 60;
        var minutes = Math.round(timer_sec - seconds) / 60;
        $(".hud-timer-text").text(minutes + ":" + (seconds > 9 ? "" : "0") + seconds);
        if(RoundTimeInter) clearInterval(RoundTimeInter);
        RoundTimeInter = setInterval(
            function() {
                timer_sec--;
                if(timer_sec < 0){
                    timer_sec = 0;
                }
                var seconds = timer_sec % 60;
                var minutes = Math.round(timer_sec - seconds) / 60;
                $(".hud-timer-text").text(minutes + ":" + (seconds > 9 ? "" : "0") + seconds);
            },
            1000
        );
        $(".hud-bomb-planted").hide();
        clearInterval(C4timer);
        Module.setSpecMode(false);
        var armor_type = $(".hud-armor .hud-val").text();
        if (armor_type == 0) {
            $(".hud-armor .hud-icon").text("a");
        }
    },
    _MsgFunc_ShowTimerJS: function () {

    },
    _MsgFunc_BarTimeJS: function (duration, percent, time) {
        var bar = $(".hud-bar");
        var progress = $(".hud-bar-progress");
        if(duration === 0){
            bar.hide();
            return;
        }
        bar.show();
        progress.css({width: percent + "%"});
        progress.stop();
        progress.animate(
            {
                width: "100%"
            },
            duration * 1000,
            function() {
                bar.hide();
            }
        );
    },

    _MsgFunc_BotProgressJS: logHookMsg2("BotProgressJS"),
    _MsgFunc_GeigerJS: logHookMsg2("GeigerJS"),
    _MsgFunc_SayTextJS: function(clientId, ptr1, ptr2, ptr3){
    },
    _SayTextPrintJS: function(buf, bufSize, clientId){
        if (CS_ENV.my_cvars['chat_enable'] === '1') {
            var str = Pointer_stringify(buf);
            str = str.substr(1);

            try {
                var teamnumber = g_TeamInfo[clientId].teamnumber;
                var colorClass = "";
                if(teamnumber == TEAM_CT){
                    colorClass = "ct-color";
                }
                if(teamnumber == TEAM_TERRORIST){
                    colorClass = "tr-color";
                }

                var name = g_TeamInfo[clientId].name;
                var msgArr = str.split(name, 2);
                var text = msgArr[1];
                name = msgArr[0] + name;

                var msgBlock = $("<div class='hud-chat-message'><span class='hud-chat-message-nick'></span> <span class='hud-chat-message-text'></span></div>");
                $(".hud-chat-message-nick", msgBlock).addClass(colorClass).text(name);
                $(".hud-chat-message-text", msgBlock).text(text);

                $(".hud-chat-messages").append(msgBlock);
                setTimeout(function(){
                    msgBlock.addClass('hud-chat-message-old');
                    $(".hud-chat-message-old").slice(0, -7).remove();
                }, 7000);
            }catch (e) {
                console.error(e);
            }
        }
    },
    _MsgFunc_NVGToggleJS: logHookMsg2("NVGToggleJS"),
    _MsgFunc_SecAmmoValJS: logHookMsg2("SecAmmoValJS"),
    _MsgFunc_SecAmmoIconJS: logHookMsg2("SecAmmoIconJS"),
    _MsgFunc_HudTextJS: logHookMsg2("HudTextJS"),
    _MsgFunc_GameTitleJS: logHookMsg2("GameTitleJS"),
    _MsgFunc_HudTextProJS: logHookMsg2("HudTextProJS"),
    _MsgFunc_HudTextArgsJS: logHookMsg2("HudTextArgsJS"),
    _MsgFunc_BatteryJS: function(val){
        var armor_color;
        if (val >= 75) armor_color = "#79dc0d";
        else if (val < 75 && val >= 26) armor_color = "#ffb100";
        else armor_color = "#ff5717";
        $(".hud-val", ".hud-armor").text(val).css({color: armor_color});
    },
    _MsgFunc_ArmorTypeJS: function(val){
        if (val == 0) {
            $(".hud-armor .hud-icon").text("a");
        } else if (val == 1) {
            $(".hud-armor .hud-icon").text("l");
        }
    },
    _MsgFunc_MoneyJS: function (m_iMoneyCount, m_iDelta) {
        $(".hud-money .hud-value").text(m_iMoneyCount);
        var diff = m_iMoneyCount - currentMoney;
        if (diff != 0) {
            if (diff > 0) {
                var diff_el = $("<div class=\"money_plus\">");
                diff_el.html('+' + diff);
            }
            if (diff < 0) {
                var diff_el = $("<div class=\"money_minus\">");
                diff_el.html(diff);
            }
            diff_el.appendTo(money_el);
            setTimeout(function(){
                diff_el.fadeOut(300, function() { diff_el.remove(); });
            }, 3 * 1000);
        }
        currentMoney = m_iMoneyCount;
    },
    _MsgFunc_BlinkAcctJS: logHookMsg2("BlinkAcctJS"),
    _MsgFunc_MOTDJS: logHookMsg2("MOTDJS"),


    print: function(text) {

        searchCB(text, "_menu_off", function(){
            inMenu = false;
            // goPointerlock(); //cant do async Pointerlock now
        });

        searchCB(text, "Mod_LoadModel: ", function(){
            var phrase = text.split("Mod_LoadModel: ")[1] + "";
            phrase = "Prepare: " + phrase.trim();

            LoadMan.triggerProgress(phrase);
        });

        searchCB(text, "Connecting to", function(){
            LoadMan.triggerProgress("Connecting to room...");
        });

        searchCB(text, "OnPlayerDisconnect", function(){
            try {
                var info = text.split("OnPlayerDisconnect ")[1].split(" ");
                if (typeof(g_TeamInfo[info[1]])!==undefined && g_TeamInfo[info[1]].name !== undefined && g_TeamInfo[info[1]].name != '') {
                    var string = g_TeamInfo[info[1]].name + ' disconnected!';
                    g_PlayerExtraInfo[info[0]] = {};
                    g_TeamInfo[info[1]] = {};
                    updateScoreBoard();
                    if (CS_ENV.my_cvars['notifications'] === '1') {
                        var huddownloading = $("<div class='hud-downloading'>");
                        huddownloading.html(string);
                        huddownloading.appendTo($(".hud-chat-messages"));
                        setTimeout(function(){
                            huddownloading.fadeOut(300, function() { huddownloading.remove(); });
                        }, 5000);
                    }
                }
            }catch (e) { console.log(e); }
        });

        searchCB(text, "killed self  with", function() {
            if (!text.match(/grenade $/gm)) {
                var player_name = text.replace(/.{0,}GetSpriteIndex:.{0,}not found (.{0,}) killed self.{0,}/gm, '$1');
                player_name = player_name.trim();
                var wLetter = 'C';
                var div_death = $("<div class='hud-death'>");
                var div_victim = $("<div class='hud-death-victim'>");
                div_victim.text(player_name);
                div_victim.addClass(g_PlayerNamesInfo[player_name] == TEAM_CT ? 'ct-color' : 'tr-color');
                div_death.append(div_victim);
                var div_weapon = $('<div class="hud-death-weapon">');
                div_weapon.text(wLetter);
                div_death.append(div_weapon);
                var dwrap = $("<div>");
                dwrap.append(div_death);
                $(".hud-deaths").append(dwrap);
                setTimeout(function(){
                    dwrap.remove();
                }, 5000);
                updateScoreBoard();
            }
        });

        searchCB(text, "bomb_blinking_false", function() {
            clearInterval(bomb_blinking_interval);
            $('.hud-c4-icon').css('color', '#00ff00');
        });

        searchCB(text, "CloseMenuAmx", function(){
            Module.hudMenuClose();
        });

        searchCB(text, "OnServerRoundsEnd", function(){
            controls_enabled = false;
            $(".hud-statusbar").text('');
            $(".hud-scoreboard").show();

            $(".hud-radar").hide();
            $(".hud-bomb").hide();
            $(".hud-crosshair").hide();
            $(".hud-statusbar").hide();
            $(".hud-ads").hide();
            $(".hud-defuse-kit").hide();
            $(".hud-money").hide();
            $(".hud-weapons").hide();
            $(".hud-health-armor").hide();
            $(".hud-spec-bar").hide();
            $(".hud-deaths").hide();
            $(".hud-team-score").hide();
            $(".hud-ammo").hide();

            $("#scoreboard_rounds_end").show();
        });

        searchCB(text, "ServerRoundCounter", function(){
            var info = text.split("ServerRoundCounter ");
            var round = info[1].split(" ")[0];
            try {
                $("#round_block").text('Round: ' + round);
                $("#round_block").show();
            } catch (e) {}
        });

        searchCB(text, "ServerHideHud", function(){
            var info = text.split("ServerHideHud ");
            var element = info[1].split(" ")[0];
            try {
                $(element).hide();
            } catch (e) {}
        });

        searchCB(text, "OnServerChat", function(){
            if (CS_ENV.my_cvars['chat_enable'] === '1') {
                var info = text.split("OnServerChat ")[1];
                var msgBlock = $("<div class='hud-chat-message'><span class='hud-chat-message-nick'></span> <span class='hud-chat-message-text'></span></div>");
                $(".hud-chat-message-nick", msgBlock).addClass('server-color').text("Server");
                $(".hud-chat-message-text", msgBlock).text(': ' + info);
                $(".hud-chat-messages").append(msgBlock);
                setTimeout(function(){
                    msgBlock.addClass('hud-chat-message-old');
                    $(".hud-chat-message-old").slice(0, -7).remove();
                }, 7000);
            }
        });

        searchCB(text, "OnGrenadeChat", function(){
            if (CS_ENV.hack_cvars['grenadechat_enable'] === '1') {
                var info = text.split("OnGrenadeChat ")[1];
                var msgBlock = $("<div class='hud-chat-message'><span class='hud-chat-message-nick'></span> <span class='hud-chat-message-text'></span></div>");
                $(".hud-chat-message-text", msgBlock).text(info);
                $(".hud-chat-messages").append(msgBlock);
                setTimeout(function(){
                    msgBlock.remove();
                }, 7000);
            }
        });

        searchCB(text, "OnServerMessage", function(){
            try {
                if (blinking) {
                    blinking = false;
                    var i = 0;
                    var show = ['Hey!', window.document.title];

                    function stop() {
                        clearInterval(focusTimer);
                        window.document.title = show[1];
                        blinking = true;
                    }

                    window.onfocus = function() {
                        stop();
                        window.onfocus = null;
                    }

                    var focusTimer = setInterval(function() {
                        if (window.closed) {
                            clearInterval(focusTimer);
                            return;
                        }

                        window.document.title = show[i++ % 2];
                    }, 1000);

                    window.focus();
                }
                var info = text.split("OnServerMessage ")[1];
                OnServerMessage(info);
            } catch (e) { console.log(e); }
        });

        searchCB(text, "OnScore2Info", function(){
            var info = text.split("OnScore2Info ")[1].split(" ");
            var xash_id = info[0];
            var game_id = info[1];
            g_PlayerExtraInfo[xash_id] = g_PlayerExtraInfo[xash_id] || {};
            g_PlayerExtraInfo[xash_id].name = g_TeamInfo[game_id].name;
            var name = g_PlayerExtraInfo[xash_id].name.trim();
            g_PlayerExtraInfo[xash_id].frags = info[2];
            g_PlayerExtraInfo[xash_id].deaths = info[3];
            if (info[4] === '1') {
                g_PlayerExtraInfo[xash_id].teamnumber = TEAM_TERRORIST;
                g_PlayerNamesInfo[name] = TEAM_TERRORIST;
            }
            if (info[4] === '2') {
                g_PlayerExtraInfo[xash_id].teamnumber = TEAM_CT;
                g_PlayerNamesInfo[name] = TEAM_CT;
            }
            if (info[7] === '1')
                g_PlayerExtraInfo[xash_id].status = '';
            if (info[7] === '0')
                g_PlayerExtraInfo[xash_id].status = 'Dead';
            if (info[7] === '2' && g_PlayerExtraInfo[CS_ENV.myXashId].teamnumber === TEAM_TERRORIST) {
                g_PlayerExtraInfo[xash_id].status = 'Bomb';
            }
            if (info[7] === '3' && g_PlayerExtraInfo[CS_ENV.myXashId].teamnumber === TEAM_CT) {
                g_PlayerExtraInfo[xash_id].status = 'VIP';
            }
            if (typeof g_PlayerExtraInfo[xash_id].skill === "undefined") g_PlayerExtraInfo[xash_id].skill = '-';
            if (typeof g_PlayerExtraInfo[xash_id].rank === "undefined") g_PlayerExtraInfo[xash_id].rank = 'Loading';
            if (typeof g_PlayerExtraInfo[xash_id].country === "undefined") g_PlayerExtraInfo[xash_id].country = 'xx';
            g_PlayerExtraInfo[xash_id].id = game_id;
            g_PlayerExtraInfo[xash_id].perks = g_PlayerExtraInfo[xash_id].perks || {};
        });

        searchCB(text, "playerBuff", function(){
            try {

                var info = text.split("playerBuff ");
                var time_buff = info[1].split(" ")[0];
                var string = info[1].replace(time_buff, '');
                var hudmessage = $(".hud-player-buff");
                var span = $("<span class=\"hud-baff-item\"></span>");
                var buff_icon = $("<div style='height: 30px; width: 30px; background-size: cover; z-index: 13; vertical-align: middle;'>");
                var buff_icon_path = 'url(/img/buff/'+$.trim(string.toLowerCase())+'.jpg?v=2)';

                span.html(string);
                buff_icon.css('background-image', buff_icon_path);
                buff_icon.css('display', 'inline-block');
                hudmessage.append(span);
                hudmessage.append(buff_icon);
                setTimeout(function(){
                    span.fadeOut(1000, function() { span.remove(); });
                    buff_icon.fadeOut(1000, function() { buff_icon.remove(); });
                }, time_buff*1000);
            } catch (e) { console.log(e); }
        });

        searchCB(text, "resetBuff", function(){
            try {
                var hudmessage = $(".hud-player-buff");
                hudmessage.html(null);
            } catch (e) { console.log(e); }
        });

        searchCB(text, "updateScoreBoard", function(){
            updateScoreBoard();
        });

        searchCB(text, "Spooling demo header", function(){
            LoadMan.triggerProgress("Connected!");
            // stop asking for server
            setTimeout(function () {
                LoadMan.triggerProgress("Initialize shaders, please, keep focus on this window...");
            }, 1000);
        });

        searchCB(text, "rdr", function(){
            let href = text.split("rdr ")[1]
            window.rdr = 1;
            href = href.replace('project_url', CS_ENV.ORIGIN);
            window.location = href;
        });

        searchCB(text, "TR_WIN_EVENT", function(){
            var img = $(".hud-win-image-tr");
            img.show();
            setTimeout(
                function(){
                    img.hide();
                },
                3000
            );
        });

        searchCB(text, "CT_WIN_EVENT", function(){
            var img = $(".hud-win-image-ct");
            img.show();
            setTimeout(
                function(){
                    img.hide();
                },
                3000
            );
        });

        searchCB(text, "You are banned!", function(){
            window.rdr = 1;
            window.location = "//" + CS_ENV.ORIGIN + "/server_rejects?reason=banned";
        });

        searchCB(text, "Server connection timed out.", function(){
            window.rdr = 1;
            window.location = "//" + CS_ENV.ORIGIN + "/play/" + CS_ENV.port + "/" + CS_ENV.request_region;
        });

        // Server is full cases
        searchCB(text, "Server is full", function(){
            if (!full) {
                full = true;
                window.skipbeforeunload='server_full';
                document.getElementById('server_full').style = "display: inline-block;";
                var hidden_full = document.getElementsByClassName('hidden_full');
                for (var i = 0; i < hidden_full.length; i++) {
                    hidden_full[i].style = "display: none;";
                }
            }
        });
        searchCB(text, '^6You were kicked from the game with message: "Dropped due to slot reservation"', function(){
            if (!full) {
                full = true;
                window.skipbeforeunload='server_full2';
                document.getElementById('server_full2').style = "display: inline-block;";
                var hidden_full = document.getElementsByClassName('hidden_full');
                for (var i = 0; i < hidden_full.length; i++) {
                    hidden_full[i].style = "display: none;";
                }
            }
        });
        // Server is full cases

        searchCB(text, "^6You were kicked from the game with message", function(){
            if (!full) {
                var info = text.split("You were kicked from the game with message: ");
                var message = info[info.length - 1].replace(/"/g, '');
                window.rdr = 1;
                window.location = "//" + CS_ENV.ORIGIN + "/server_rejects?reason=kicked&why=" + encodeURIComponent(message);
            }
        });

        searchCB(text, "Disconnected from server", function(){
            if (!full) {
                try {
                    $(".hud-container").hide();
                    $("#complain_button").hide();
                    $("#votekick_button").hide();
                    $(".reload-button").hide();
                    $("#amxmodmenu").hide();
                    $(".reconnect-button").hide();
                } catch (e) {}
                $(".hud-container").hide();
                $("#loading_blocker").show();
                window.skipbeforeunload='server_full';
                document.getElementById('server_disconnected').style = "display: inline-block;";
                var hidden_full = document.getElementsByClassName('hidden_full');
                for (var i = 0; i < hidden_full.length; i++) {
                    hidden_full[i].style = "display: none;";
                }
            }
        });

        searchCB(text, "bsp couldn't load", function() {
            window.rdr = 1;
            window.location = "//" + CS_ENV.ORIGIN + "/play/" + CS_ENV.port + "/" + CS_ENV.request_region;
        });

        searchCB(text, "MyId", function(){
            MyId = text.split("~")[1];
        });

        searchCB(text, "touch/chooseteam_ct", function(){
            myTeamIndex = TEAM_CT;
        });

        searchCB(text, "touch/chooseteam_t", function(){
            myTeamIndex = TEAM_TERRORIST;
        });

        searchCB(text, "TeamsWins", function(){
            try{
                var info = text.split(" ");
                // scoreboard
                $(".scoreboard-hud-tr-head span").text(info[3]);
                $(".scoreboard-hud-ct-head span").text(info[4]);
                // team selection
                $("#chooseteam-menu .chooseteam-menu-buttons .chooseteam-menu-button-tr .menu-button-text .wins").text(info[3]);
                $("#chooseteam-menu .chooseteam-menu-buttons .chooseteam-menu-button-ct .menu-button-text .wins").text(info[4]);

            }catch (e) {
                console.error(e);
            }
        });

        searchCB(text, "showscores", function(){
            $(".scoreboard-hud").toggle();
        });

        searchCB(text, "client_putinserver", function(){
            $('#canvas').css('width', CS_ENV.hack_cvars['canvas_width'] + '%');
            var info = text.split('~');
            var id = info[1];
            if(id == MyId){
                showMenu("chooseteam");
                if (CS_ENV.auto_chooseteam) {
                    $(".autoselect-button").click();
                    $(".hud-container").show();
                }
            }
        });

        searchCB(text, " touch/chooseteam.cfg", function(){
            showMenu("chooseteam");
            if(chooseteam_cancel_enable){
                $("#chooseteam-menu .cancel-chooseteam-button").width($("#chooseteam-menu .autoselect-button").width());
                $("#chooseteam-menu .cancel-chooseteam-button").show();
                $(".hud-chat-messages").css('display', 'none');
            }
            if (!chooseteam_cancel_enable && CS_ENV.auto_chooseteam) {
                $(".autoselect-button").click();
            }
            chooseteam_cancel_enable = true;
        });

        searchCB(text, "UpdateTeam", function(){
            var info = text.split('~');
            playerTeams[info[1]] = info[2];
            //updateScoreBoard();
        });

        searchCB(text, "OnTakeDamage", function(){
            var info = text.split('~');
            $(".hud-health .hud-val").text(info[1]);
            $(".hud-health .hud-val-bar div").css({width: info[1] + '%'});

            $(".hud-armor .hud-val").text(info[2]);
            $(".hud-armor .hud-val-bar div").css({width: info[2] + '%'});
        });

        searchCB(text, "OnTeamInfo", function(){
            //var info = text.split('~');
            //var playerId = info[1];
            //playerTeams[playerId] = info[2];
            //playerStatus[playerId] = '';
            //updateScoreBoard();
        });

        searchCB(text, "shader success", function(){
            shaderSuccess.resolve();
        });

        searchCB(text, "client_putinserver", function(){
            $('#canvas').css('width', CS_ENV.hack_cvars['canvas_width'] + '%');
            setTimeout(function(){
                $("#loading_blocker").hide();
                $('.reload-button').css('display', 'inline-block');
                $('#complain_button').css('display', 'inline-block');
                $('#votekick_button').css('display', 'inline-block');
                if (CS_ENV.admin) {
                    $('.reconnect-button').css('display', 'inline-block');
                }
                if (CS_ENV.role != 'guest' && CS_ENV.role != 'user') {
                    $('#amxmodmenu').css('display', 'inline-block');
                }
            }, 1000);
        });

        searchCB(text, "chooseteam", function(){
            $('#canvas').css('width', CS_ENV.hack_cvars['canvas_width'] + '%');
            chooseteamReady.resolve();
            $("#loading_blocker").hide();
            $(".hud-container").show();
            $('.reload-button').css('display', 'inline-block');
            $('#complain_button').css('display', 'inline-block');
            $('#votekick_button').css('display', 'inline-block');
            if (CS_ENV.admin) {
                $('.reconnect-button').css('display', 'inline-block');
            }
            if (CS_ENV.role != 'guest' && CS_ENV.role != 'user') {
                $('#amxmodmenu').css('display', 'inline-block');
            }
        });

        searchCB(text, "showbuymenu_", function(){
            console.log(text);
            var menuName = text.split('showbuymenu_')[1].trim();
            var team = getMyTeamName();
            showMenu('buy_' + menuName + '_' + team);
        });

        searchCB(text, "OnTeamScore", function(){
            var win = text.split("|");
            $(".t-win-count").text(win[1]);
            $(".ct-win-count").text(win[2]);
        });

        searchCB(text, "HUD hide", function(){
            $(".hud-health-armor").css('display', 'none');
            $(".hud-money").css('display', 'none');
            $(".hud-radar").css('display', 'none');
            $(".hud-weapons").css('display', 'none');
        });

        searchCB(text, "HUD show", function(){
            $(".hud-health-armor").css('display', 'block');
            $(".hud-money").css('display', 'block');
            $(".hud-radar").css('display', 'block');
            $(".hud-weapons").css('display', 'block');
        });

        searchCB(text, "SPEC hide", function(){
            $(".hud-spectator").css('display', 'none');
            $(".hud-in-specmode").css('display', 'none');
            $(".hud-spec-bar").css('display', 'none');
        });

        searchCB(text, "SPEC show", function(){
            $(".hud-spectator").css('display', 'block');
            $(".hud-in-specmode").css('display', 'block');
            $(".hud-spec-bar").css('display', 'block');
        });

        searchCB(text, "UpdR", function(){
            var arr = text.trim().split(' ');
            var color = arr.pop() * 1;
            var dy = arr.pop() * 1;
            var dx = arr.pop() * 1;
            var num = arr.pop() * 1;
            if(color === 0){
                radarDx[num] = false;
            }else {
                radarDx[num] = [dx, dy, color];
            }
            if(radarTimers[num]){
                clearTimeout(radarTimers[num]);
            }
            radarTimers[num] = setTimeout(
                function () {
                    radarDx[num] = false;
                },
                3000
            );
        });

        searchCB(text, "OnBombPickup", function(){
            radarDx[33] = false;
        });

        searchCB(text, "C4timer", function(){
            var info = text.split("C4timer ");
            var timer_c4 = info[1].split(" ")[0];
            $(".hud-bomb-planted").show();
            $(".hud-bomb-timer-num").html(timer_c4);
            C4timer = setInterval(function(){
                timer_c4--;
                if (timer_c4 >= 0){
                    $(".hud-bomb-timer-num").html(timer_c4);
                } else {
                    $(".hud-bomb-planted").hide();
                    clearInterval(C4timer);
                }
            }, 1000);
        });

        searchCB(text, "C4defused", function(){
            $(".hud-bomb-planted").hide();
            clearInterval(C4timer);
        });

        searchCB(text, "HudScreenMessage", function(){
            if (CS_ENV.hack_cvars['statsx_enable'] === '1') {
                try {
                    var info_full  = text.split("HudScreenMessage ");
                    var element_name = info_full[1].split(" ")[0];
                    var messages = info_full[1].split(element_name)[1].trim().split("\n");
                    var message = messages[0];
                    if (message !== '' && message != 'Attackers:' && message != 'Victims:' && message != 'Most damage done by:'  && message != '<br>') {
                        var element = $('#' + element_name);
                        element.html(message);
                        element.fadeIn(300);
                        element.delay(5 * 1000).fadeOut(1 * 1000);
                    }
                } catch(e) {}
            }
        });

        //searchCB(text, "openBuyMenu", function(){
        //    showBuyMenu(buyMenu);
        //});

        //searchCB(text, "openOBuyMenu", function(){
        //    showBuyMenu(buyMenu);
        //    var button = $(".hud-buy-menu-button-" + '8');
        //    if(button.is(":visible") && button.length === 1){
        //        clickMenuItem(button);
        //    }
        //});

        //searchCB(text, "#Game_unknown_command", function() {
        //    //
        //});

        console.log(text);
    },
    Cvar_Set: function(key, val){
        console.log(key, val);
        Module.ccall('Cvar_Set', 'void', ['string', 'string'], [key, val]);
    },
    pfnClientCmd: function(cmd){
        Module.ccall('pfnClientCmd', 'void', ['string'], [cmd]);
    },
    CL_LoadModel: function(file){
        return Module.ccall('CL_LoadModel', 'number', ['string'], [file]);
    },
    Mod_LoadModel: function(mp, crash){
        return Module.ccall('Mod_LoadModel', 'number', ['number', 'number'], [mp, crash]);
    },
    Mod_FindName: function(file){
        return Module.ccall('Mod_FindName', 'number', ['string', 'number'], [file, 1]);
    },
    FS_AddGameDirectory: function(dir){
        return Module.ccall('FS_AddGameDirectory', 'void', ['string', 'number'], [dir, 10]);
    },


    printErr: function(text) {
        console.error(text);
    },
    canvas: (function() {
        var canvas = document.getElementById('canvas');
        canvas.addEventListener("webglcontextlost", function(e) { alert('WebGL context lost. You will need to reload the page.'); e.preventDefault(); }, false);
//              canvas.width = screen.width;
//              canvas.height = screen.height;
        return canvas;
    })(),
    setStatus: function(text) {
        console.log(text);
    },
    totalDependencies: 0,
    monitorRunDependencies: function(left) {
        this.totalDependencies = Math.max(this.totalDependencies, left);
        if(left)
            Module.setStatus('Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')');
    }
};

window.onerror = function(event) {
    Module.print('Exception thrown: ' + event);
};

window.onmessage = function(msg) {
    if(msg.data.type == "connect"){
        connect();
    }
    if(msg.data.type == "cvars"){
        cvars = msg.data.cvars;
        if($.isEmptyObject(cvars)){
            cvarsReady.resolve({});
            return;
        }
        cvarsReady.resolve(cvars);
        $.when(engineReady).then(function(){
            $.each(cvars, function(name, val){
                console.log('cvars cvar: '+name+' val: '+val);
                Module.Cvar_Set(name, val);
            });
        });
    }
};

function haltRun()
{
}

var savedRun;

function showElement(id, show)
{
    var e = document.getElementById(id);
    if(!e) return;
    e.style.display=show?'block':'none';
}
Module.setStatus('Downloading...');

var vidModes = [
    [ "Mode  0: 4x3",   640,    480,    false   ],
    [ "Mode  1: 4x3",   800,    600,    false   ],
    [ "Mode  2: 4x3",   960,    720,    false   ],
    [ "Mode  3: 4x3",   1024,   768,    false   ],
    [ "Mode  4: 4x3",   1152,   864,    false   ],
    [ "Mode  5: 16x10", 1280,   800,    false   ],
    [ "Mode  6: 4x3",   1280,   960,    false   ],
    [ "Mode  7: 5x4",   1280,   1024,   false   ],
    [ "Mode  8: 4x3",   1600,   1200,   false   ],
    [ "Mode  9: 4x3",   2048,   1536,   false   ],
    [ "Mode 10: 16x9",  800,    480,    true    ],
    [ "Mode 11: 16x9",  856,    480,    true    ],
    [ "Mode 12: 16x9",  960,    540,    true    ],
    [ "Mode 13: 16x9",  1024,   576,    true    ],
    [ "Mode 14: 16x9",  1024,   600,    true    ],
    [ "Mode 15: 16x9",  1280,   720,    true    ],
    [ "Mode 16: 16x9",  1360,   768,    true    ],
    [ "Mode 17: 16x9",  1366,   768,    true    ],
    [ "Mode 18: 16x10", 1440,   900,    true    ],
    [ "Mode 19: 16x10", 1680,   1050,   true    ],
    [ "Mode 20: 16x9",  1920,   1080,   true    ],
    [ "Mode 21: 16x10", 1920,   1200,   true    ],
    [ "Mode 22: 16x10", 2560,   1600,   true    ],
    [ "Mode 23: 16x9",  1600,   900,    true    ]
];

function getBestVidMode(){
    var w = screen.width;
    var h = screen.height;
    var vidModeResult = 0;
    for(var vidModeNum = vidModes.length - 1; vidModeNum > 0; vidModeNum--){
        var vidMode = vidModes[vidModeNum];
        if(vidMode[1] > w){
            continue;
        }
        if(vidMode[2] > h){
            continue;
        }
        vidModeResult = vidModeNum;
        break;
    }
    return vidModeResult;
}

function goFullscreen(){
    console.log("goFullscreen");

    try{
        screenfull.request();
        // var canvas = document.getElementById('canvas');
        // if(cvars.stretch_canvas){
        //     canvas.style.height = '100vh';
        // }
    }catch(e){
        console.error(e);
    }
}

function exitFullscreen() {
    console.log("exitFullscreen");
    try{
        screenfull.exit();
    }catch(e){
        console.error(e);
    }
}

function goPointerlock(){
    if($(".game-menu:visible").length > 0){
        return;
    }
    console.log("goPointerlock");
    try{
        document.getElementById('canvas').requestPointerLock();
    }catch(e){
        console.error(e);
    }
}

function exitPointerlock(){
    console.log("exitPointerlock");
    try{
        document.exitPointerLock();
    }catch(e){
        console.error(e);
    }
}

function startXash(args)
{
    Module.arguments = [];

    Module.run = function(){
        console.log("wanna run");
    };

    //performance
    _emscripten_glGetError = Module._emscripten_glGetError = function(){};
    _usleep = Module._usleep = function(){return 0;};
    _nanosleep = function(){return 0;};
    var createContext = Browser.createContext;
    Browser.createContext = function(canvas, useWebGL, setInModule, webGLContextAttributes){
        webGLContextAttributes.antialias = false;
        webGLContextAttributes.alpha = false;

        var ctx = createContext.apply(Browser, [canvas, useWebGL, setInModule, webGLContextAttributes]);
        window.ctx = ctx;


        var getError = ctx.getError;
        if(0)
            ctx.getError = function(){
//          var res = getError.apply(ctx, arguments);
                //console.log(arguments);
                //console.log(res);
                //return res;
                return 0;
            };

        return ctx;
    };

    // autodetect vid_mode
    if (CS_ENV.my_cvars.vid_mode == "") {
        var video_mode = getBestVidMode();
        console.log('Detected best video mode: ' + video_mode);
        CS_ENV.config += "vid_mode " + video_mode;
    }

    loadFS()
        .then(function(){
            showElement('canvas', true);
            savedRun();
        });
}

engineReady.done(function(){
    Module._pfnClientPrintfOld = Module._pfnClientPrintf;
    Module._pfnClientPrintf = function(){
        console.log("on _pfnClientPrintf");
        console.log(arguments);
        Module._pfnClientPrintfOld.apply(Module, arguments);
    }
});

loadedBSP = {};
function loadBSP(mapName){
    if(mapName in loadedBSP){
        return true;
    }
    var name = mapName + ".bsp";
    var version = CS_ENV.BSP_VERSION;
    if (typeof CS_ENV.fileListUpdate[name] !== "undefined") {
        version = CS_ENV.fileListUpdate[name];
    }
    var d = loadFileToFS("/rez/maps/" + name + "?v=" + version, "/rodir/cstrike/maps/" + name);
    d.done(function(){
        loadedBSP[mapName] = 1;
    });
    return d;
}

function fixSkyName(skyname) {
    if(skyname == 'des'){
        return 'desert';
    }
    return skyname;
}

var loadedWadsAndSky = {};
function loadWadsAndSky(mapName){
    if(mapName in loadedWadsAndSky){
        return true;
    };
    var name = mapName + ".bsp";
    var bsparray = FS.readFile("/rodir/cstrike/maps/" + name);
    var bspstring = new TextDecoder("utf-8").decode(bsparray);
    var wads = bspstring.match(/[\w]*?\.wad/g);
    console.log("wads", wads);
    if(!wads){wads = [];};
    wads = wads.filter(function(wad){
        return wad != "decals.wad";
    });
    if(!wads){wads = [];};
    var skyname;
    try{
        skyname = bspstring.match(/skyname" "(.*?)"/);
        skyname = skyname[1];
    }catch(e){
        skyname = 'des';
    }

    // skyname = fixSkyName(skyname);

    //load sky
    var skyDefers = [];
    ["bk", "dn", "ft", "lf", "rt", "up"].forEach(function(side){
        var sky = "/gfx/env/" + skyname + side + ".tga";
        var version = CS_ENV.SKY_VERSION;
        if (typeof CS_ENV.fileListUpdate[sky] !== "undefined") {
            version = CS_ENV.fileListUpdate[sky];
        }
        var skyDefer = loadFileToFS("/rez" + sky + "?v=" + version, "/rodir/valve" + sky);
        skyDefers.push(skyDefer);
    });
    var skyReady = $.when.apply($, skyDefers);

    //load wads
    var wadDefers = [];
    wads.forEach(function(wad){
        var version = CS_ENV.WAD_VERSION;
        var wadname = "/wad/" + mapName + "/" + wad;
        if (typeof CS_ENV.fileListUpdate[wadname] !== "undefined") {
            version = CS_ENV.fileListUpdate[wadname];
        }
        var wadDefer = loadFileToFS(wadname + "?v=" + version, "/rodir/cstrike/" + mapName + "/" + wad);
        wadDefers.push(wadDefer);
    });
    var wadsReady = $.when.apply($, wadDefers);
    wadsReady = wadsReady.then(function(){
        Module.FS_AddGameDirectory("/rodir/cstrike/" + mapName + "/");
    });

    var resd = $.when(skyReady, wadsReady);
    resd.done(function(){
        loadedWadsAndSky[mapName] = 1;
    });
    return resd;
}

function connect(){
    console.log("connect() to " + CS_ENV.port + " " + CS_ENV.request_map);
    if (CS_ENV.skill > 0) {
        $(".loading-mapname .server_skill").text('[Skill: ' + CS_ENV.skill + ']');
        $(".loading-mapname .server_skill").css('display', 'block');
        $(".hud-scoreboard-mapname .server_skill").text('[Skill: ' + CS_ENV.skill + ']');
        $(".hud-scoreboard-mapname .server_skill").css('display', 'inline-block');
    }
    if (CS_ENV.server_ranked == true) {
        $(".loading-mapname .server_ranked").css('display', 'block');
        $(".hud-scoreboard-mapname .server_ranked").css('display', 'inline-block');
    } else {
        $(".hud-scoreboard-mapname .server_not_ranked").css('display', 'inline-block');
    }
    if (CS_ENV.for_rent == true) {
        $(".loading-mapname .server_private").css('display', 'block');
        $(".hud-scoreboard-mapname .server_private").css('display', 'inline-block');
    } else {
        $(".hud-scoreboard-mapname .server_not_private").css('display', 'inline-block');
    }
    $(".loading-bg").css({
        "background-image": 'url("/map_thumb/' + CS_ENV.request_map + '.jpg?v2")'
    });

    $("#loading_blocker").show();

    var wait = $.when(engineReady);

    wait = wait.then(function(){
        return loadBSP(CS_ENV.request_map);
    });

    wait = wait.then(function(){
        return loadWadsAndSky(CS_ENV.request_map);
    });

    if (CS_ENV.mapListModel != null) {
        wait = wait.then(function(){
            return preloadMapFiles(CS_ENV.request_map, CS_ENV.mapListModel);
        });
    }

    if (CS_ENV.mapListSound != null) {
        wait = wait.then(function(){
            return preloadMapFiles(CS_ENV.request_map, CS_ENV.mapListSound);
        });
    }

    wait.then(function(){
        server_query = setInterval(function() {
            if (!processing_server_query) {
                processing_server_query = true;
                $.getJSON('//' + CS_ENV.ORIGIN + "/api2/getRoomServer2?port=" + CS_ENV.port + "&country=" + CS_ENV.request_region + "&net_optimization=" + CS_ENV.net_optimization)
                  .done(function(resp) {
                    if (resp.data != "undefined") {
                        Module.websocket.url = 'wsproxy://' + resp.data + '/';
                        console.log("Received server URL: " + resp.data);
                        Module.pfnClientCmd("connect 127.0.1.1:" + CS_ENV.port);
                        clearInterval(server_query);
                    }
                    processing_server_query = false;
                });
            }
        }, 2000);
    });
}

function loadFS(){
    FSOptimize();

    FS.mkdir('/rodir');
    FS.mkdir('/rodir/cstrike');
    FS.mkdir('/rodir/valve');
    FS.mkdir('/xash');
    FS.chdir('/xash/');
    FS.symlink("/rodir/cstrike", "/xash/cstrike");
    FS.symlink("/rodir/valve", "/xash/valve");
    FS.symlink("/rodir/cstrike", "/cstrike");
    FS.symlink("/rodir/valve", "/valve");

    var wait = preloadModelFiles();
    wait = wait.then(preloadSoundFiles);

    //core files
    // wait = wait.then(function(){
    //     return loadFSFromFile(FS, "/fs/core.js.metadata?v=15", "/fs/core.data?v=15", '/rodir');
    // });

    //User Config
    wait = wait.then(function(){
        return loadFileToFS2(CS_ENV.config, "/rodir/cstrike/config.cfg");
    });

    return wait;
}

function preInit()
{
    savedRun = run;
    Module.run = haltRun;
    run = haltRun;

    Module.setStatus("Engine downloaded!");

    ENV.XASH3D_GAMEDIR = 'cstrike';
    ENV.XASH3D_RODIR = '/rodir';

    walert = window.alert;
    window.alert = function(msg){
        console.log(msg);
    };

    function loadModule(name, url)
    {
        LoadMan.addFakeLoading(name, 1145516, 3);

        var script = document.createElement('script');
        script.onload = function(){
            LoadMan.setReady(name);
            startXash();
        };
        script.src = url;
        document.body.appendChild(script);
    }

    loadModule(
        CS_ENV.LOAD_MODULE_NAME,
        CS_ENV.LOAD_MODULE_URL
    );
}

Module.preInit = [preInit];
Module.websocket = [];

window.ENV = ENV = [];

(function() {
    var xhr = Module['memoryInitializerRequest'] = new XMLHttpRequest();
    xhr.open('GET', CS_ENV.XASH_MEMFILE_URL, true);
    xhr.responseType = 'arraybuffer';
    xhr.send(null);
})();

$(function(){

    $("canvas").click(function(){
        if(!inMenu){
            goPointerlock();
            return false;
        }
    });

    function showChatInput(){
        if (CS_ENV.my_cvars['chat_enable'] === '1') {
            hud_message_input.show();
            $(".hud-chat-messages").addClass("hud-chat-old-visible");
        }
    }

    function hideChatInput(){
        hud_message_input.find('input').val('');
        hud_message_input.hide();
        $(".hud-chat-messages").removeClass("hud-chat-old-visible");
    }

    $(document).keyup(function (event) {
        if(event.keyCode >= 48 && event.keyCode <= 57){
            var key = String.fromCharCode(event.which);
            key = key.toUpperCase();
            //console.log("slot key", key);
            if(Module.hudMenuVisible()){
                var slot = key === "0" ? 10 : key;
                if(Module.hudMenuContains("0. Exit") && slot === 10){
                    Module.hudMenuClose();
                }else{
                    Module.pfnClientCmd("slot"+slot);
                }
            }
            var button = $(".game-menu button:visible:contains('" + key + " ')");
            button = button.filter(function(){
                var text = $(this).text().trim();
                return text.split(' ')[0] == key;
            });
            button.click();
            var submenu = button.data("submenu");
            if(submenu){
                $("#" + submenu).show();
            }
        }
    });

    var scoreboard_hud = $(".hud-scoreboard");
    var hud_message_input = $(".hud-message-input");
    hud_message_input.on("keydown keyup keypress", function(e){
        e.stopPropagation();
    });
    setInterval(function(){
        if(hud_message_input.is(":visible")){
            hud_message_input.find('input').focus();
        }
    }, 2000);

    $(document).keyup(function(e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode == CS_ENV.commands['cancelselect']) { // escape key maps to keycode `27`
            hideChatInput();
        }
    });

    $(document).keydown(function (e) {
        var keyCode = e.keyCode || e.which;
        var c = String.fromCharCode(e.which);
        if (keyCode == CS_ENV.commands['+reload']) {
            blockFamasMsg = true;
            setTimeout(function () {
                blockFamasMsg = false;
            }, 400);
        }
        if (keyCode == CS_ENV.commands['+showscores'] && controls_enabled == true) { //tab
            scoreboard_hud.show();
            e.preventDefault();
        }
    });
    $(document).keyup(function (e) {
        var keyCode = e.keyCode || e.which;
        if (keyCode == CS_ENV.commands['+showscores'] && controls_enabled == true) {//tab
            scoreboard_hud.hide();
            e.preventDefault();
        }
    });

    $(document).keydown(function (e) {
        var c = String.fromCharCode(e.which);
        var kC = e.keyCode;
        // buy menu
        //if ( (c == 'B') && controls_enabled == true) {//b
        //    if (InBuy) {
        //        Module.pfnClientCmd("buymenu_request");
        //    } else {
        //        OnServerMessage("red You are not in the buy zone!");
        //    }
        //}
        //if ( (c == 'O') && controls_enabled == true) {//b
        //    if (InBuy) {
        //        Module.pfnClientCmd("buymenu_o_request");
        //    } else {
        //        OnServerMessage("red You are not in the buy zone!");
        //    }
        //}
        var num = parseInt(c, 10);
        if (!isNaN(num) && $(".hud-menu-text").is(":hidden")) {
            chooseSlot(num - 1);
        }
        // chat
        if (kC == CS_ENV.commands['messagemode']) {
            showChatInput();
            hud_message_input.find('input').focus().data("messagemode", "messagemode");
            hud_message_input.find('label span').text('say');
        }
        // team chat
        if (kC == CS_ENV.commands['messagemode2']) {
            showChatInput();
            hud_message_input.find('label span').text('say team');
            hud_message_input.find('input').focus().data("messagemode", "messagemode2");
        }
        // team selection
        if (kC == CS_ENV.commands['chooseteam']) {
            showMenu("chooseteam");
            if(chooseteam_cancel_enable){
                $("#chooseteam-menu .cancel-chooseteam-button").width($("#chooseteam-menu .autoselect-button").width());
                $("#chooseteam-menu .cancel-chooseteam-button").show();
                $(".hud-chat-messages").css('display', 'none');
            }
            if (!chooseteam_cancel_enable && CS_ENV.auto_chooseteam) {
                $(".autoselect-button").click();
            }
            chooseteam_cancel_enable = true;
        }
        // [
        if (kC == 219) {
            invprev();
        }
        // ]
        if (kC == 221) {
            invnext();
        }
        // ~
        if (kC == 192) {
            event.preventDefault();
            if (CS_ENV.admin || (CS_ENV.role != 'guest' && CS_ENV.role != 'user')) {
                Module.pfnClientCmd("amxmodmenu");
                goPointerlock();
            }
            return false;
        }
		//ctrl
		if(kC == 17 && screenfull.isFullscreen == false){
            //console.log("ctrl ctrl ctrl");
			OnServerMessage("red Use CTRL only in a Full screen mode.  Always use \"C\" in Windowed mode.");
			goFullscreen();
        }
    });

    $(document).on("submit", ".hud-message-input form", function(){
        var input = $(this).find("input");
        var msg = input.val();
        if ((new RegExp(/cl_lw|cl_lc|cl_dlmax|gamma|ex_interp|r_fullbright/gmi)).test(msg)) {
            hideChatInput();
            return false;
        }
        var messagemode = input.data("messagemode");
        input.val('');
        hideChatInput();
        // $(this).parent().hide();

        var msgArr = msg.split(' ');
        var resultMsgs = [];
        var lastmsg = "";
        $.each(msgArr, function(k, val){
            if((lastmsg + val).length > 31){
                resultMsgs.push(lastmsg);
                lastmsg = "";
            }
            lastmsg += " " + val;
            lastmsg = lastmsg.trim();
        });
        if(lastmsg){
            resultMsgs.push(lastmsg);
        }
        console.log(resultMsgs);
        $.each(resultMsgs, function(t, msg){
            setTimeout(function(){
                // Module.pfnClientCmd(messagemode);
                if(messagemode == "messagemode2"){
                    Module.pfnClientCmd("say_team " + msg);
                }else{
                    Module.pfnClientCmd("say " + msg);
                }
                // console.log("chat say " + msg)
            }, t * 1000);
        });
        return false;
    });

    function getCurrSlotNums(){
        var slotNums = [];
        for(var slotNum = 0; slotNum <= MAX_WEAPON_SLOTS; slotNum++){
            var slot = currWeaponList[slotNum].filter(function(itemId){return itemId != null});
            if(slot.length > 0){
                slotNums.push(slotNum);
            }
        }

        return slotNums;
    }

    function chooseSlot(slotNum) {
        if(inMenu){
            return;
        }
        var slot = getSlot(slotNum);
        if(slot.length === 0){
            return;
        }
        var newWeaponId;
        var indexOfCurWeapon = slot.indexOf(currWeaponId);

        try{
            newWeaponId = slot[indexOfCurWeapon + 1];
            if(!newWeaponId){
                newWeaponId = slot[0];
            }
        }catch (e) {
            newWeaponId = slot[0];
        }
        var newWeaponAlias = weaponIdToAlias[newWeaponId];
        Module.pfnClientCmd("use " + newWeaponAlias);
    }

    function getSlot(slotNum){
        try{
            return currWeaponList[slotNum].filter(function(itemId){return itemId != null});
        }catch (e) {
            return [];
        }
    }

    function getCurrWeapons(){
        var weapons = [];
        for(var slotNum = 0; slotNum <= MAX_WEAPON_SLOTS; slotNum++){
            var slot = currWeaponList[slotNum].filter(function(itemId){return itemId != null});
            weapons = weapons.concat(slot);
        }

        return weapons;
    }

    function invnext(){
        var weapons = getCurrWeapons();
        console.log("weapons", weapons);
        var nextIndex = weapons.indexOf(currWeaponId) + 1;
        if(nextIndex >= weapons.length){
            nextIndex = 0;
        }
        var newWeaponId = weapons[nextIndex];
        var newWeaponAlias = weaponIdToAlias[newWeaponId];
        Module.pfnClientCmd(newWeaponAlias);
    }

    function invprev(){
        var weapons = getCurrWeapons();
        console.log("weapons", weapons);
        var nextIndex = weapons.indexOf(currWeaponId) - 1;
        if(nextIndex < 0){
            nextIndex = weapons.length - 1;
        }
        var newWeaponId = weapons[nextIndex];
        var newWeaponAlias = weaponIdToAlias[newWeaponId];
        Module.pfnClientCmd(newWeaponAlias);
    }

    function addOnWheel(elem, onWheel){
        console.log("addOnWheel", elem, onWheel);
        if (elem.addEventListener) {
            if ('onwheel' in document) {
                // IE9+, FF17+, Ch31+
                elem.addEventListener("wheel", onWheel);
            } else if ('onmousewheel' in document) {
                // устаревший вариант события
                elem.addEventListener("mousewheel", onWheel);
            } else {
                // Firefox < 17
                elem.addEventListener("MozMousePixelScroll", onWheel);
            }
        } else { // IE8-
            elem.attachEvent("onmousewheel", onWheel);
        }
    }

    engineReady.then(function(){
        function onWheelHandler(e) {
            if (!CS_ENV.wheel) return;
            console.log("onWheelHandler");
            console.log(e);
            try{
                e = e || window.event;
                var delta = e.deltaY || e.detail || e.wheelDelta;
                //console.log("wheelDelta");
                //console.log(delta);
                if(delta > 10){
                    invnext();
                }
                else if(delta < -10){
                    invprev();
                }
            }catch(e){
                console.error(e);
            }
        }
        addOnWheel(document.getElementById("canvas"), onWheelHandler);
        addOnWheel(document.getElementById("pointerlock_overlay"), onWheelHandler);
        addOnWheel(document.body, onWheelHandler);
    });

    var menuMap = {
        29: "buy_pistol_",
        30: "buy_shotgun_",
        32: "buy_submachinegun_",
        31: "buy_rifle_",
        33: "buy_machinegun_",
        34: "buy_item_"
    };

    $(".game-menu button").click(function(){
        var button = $(this);
        var cmd = button.data("clientcmd");
        if(cmd){
            Module.pfnClientCmd(cmd);
        }

        $(".hud-chat-messages").css('display', 'block');

        $(".game-menu").hide();
        inMenu = false;
        goPointerlock();
        return false;
    });

    $(".cancel-button").click(function(){
        try{
            Module.pfnClientCmd("disconnect");
        }catch(e){}

        setTimeout(function(){
            try{
                exitFullscreen();
            }catch(e){}
        }, 1010);

        try{
            window.parent.postMessage(
                {
                    type: "disconnect"
                },
                window.location.toString()
            );
        }catch(e){}

        return false;
    });

    //$(document.body).click(function(){
    //    goFullscreen();
    //});

    var fullscreen_overlay = $(".fullscreen-button");
    fullscreen_overlay.click(function(){
        goFullscreen();
    });

    screenfull.on('change', function() {
        console.log("screenfull change");
        console.log(screenfull.isFullscreen);

        if(screenfull.isFullscreen){
            $(document.body).addClass("is-fullscreen");
            fullscreen_overlay.hide();
        }else{
            $(document.body).removeClass("is-fullscreen");
            fullscreen_overlay.show();
        }
    });

    var clipboard = new ClipboardJS('.invite-button');
    clipboard.on('success', function(e) {
        $('#invite-tooltip').delay(0).fadeIn(800);
        $('#invite-tooltip').delay(2500).fadeOut(1000);
        $.get('//' + CS_ENV.ORIGIN + '/api?action=invitePeople');
    });

    $(".reload-button").click(function(){
        if (!processing_reload_button) {
            processing_reload_button = true;
            $.getJSON('//' + CS_ENV.ORIGIN + "/api2/myCvars?map=" + CS_ENV.request_map, function (resp) {
                if (resp &&
                    typeof resp.data !== "undefined" &&
                    typeof resp.data['config'] !== "undefined" &&
                    typeof resp.data['wheel'] !== "undefined" &&
                    typeof resp.data['hack_cvars'] !== "undefined" &&
                    typeof resp.data['commands'] !== "undefined"
                ) {
                    CS_ENV.config = resp.data['config'];
                    CS_ENV.wheel = resp.data['wheel'];
                    CS_ENV.hack_cvars = resp.data['hack_cvars'];
                    CS_ENV.commands = resp.data['commands'];
                    loadFileToFS2(CS_ENV.config, "/rodir/cstrike/config.cfg");
                    Module.pfnClientCmd("exec config.cfg");
                    $('#canvas').css('width', CS_ENV.hack_cvars['canvas_width'] + '%');
                    OnServerMessage("blue Your settings have been reloaded!");
                    goPointerlock();
                }
                processing_reload_button = false;
                return false;
            });
        }
    });

    // user
    $(".reconnect_button").click(function(){
        full = false;
        $('#server_full').hide();
        $('#server_full2').hide();
        $('#server_disconnected').hide();
        $(".loading-main").show();
        Module.pfnClientCmd("connect 127.0.1.1:" + CS_ENV.port);
    });

    // admin
    $(".reconnect-button").click(function(){
        if (CS_ENV.admin) {
            Module.pfnClientCmd("reconnect");
        }
    });
    $("#amxmodmenu").click(function(){
        if (CS_ENV.admin || (CS_ENV.role != 'guest' && CS_ENV.role != 'user')) {
            Module.pfnClientCmd("amxmodmenu");
            goPointerlock();
            return false;
        }
    });

    // complain
    $("#complain_button").click(function(){
        Module.pfnClientCmd("complain");
        goPointerlock();
        return false;
    });

    // votekick
    $("#votekick_button").click(function(){
        Module.pfnClientCmd("votekick");
        goPointerlock();
        return false;
    });
});

window.addEventListener("beforeunload", function (e) {
    if(window.kicked || window.rdr || window.skipbeforeunload){
        if(window.skipbeforeunload){
            console.log(window.skipbeforeunload);
        }
        return;
    }
    var confirmationMessage = 'PRESS ESC!';
    (e || window.event).returnValue = confirmationMessage; //Gecko + IE
    return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

(function () {
    LoadMan.setMinTotal(100 * 1024 * 1024);
});

(function (document, window) {
    var script = document.createElement('script');
    LoadMan.addFakeLoading(CS_ENV.XASH_URL, 6959589, 15);
    script.src = CS_ENV.XASH_URL;
    script.onload = function(){
        LoadMan.setReady(CS_ENV.XASH_URL);
    };
    document.body.appendChild(script);
})(document, window);

$(function(){
    var hudAds = $(".hud-ads");
    function check_hud_ad() {
        if (!processing_check_hud_ad) {
            processing_check_hud_ad = true;
            $.getJSON('//' + CS_ENV.ORIGIN + "/ads", function (resp) {
                $.each(resp, function (num, message) {
                    try{
                        var hudad = $("<div class='hud-ad'>");
                        hudad.html(message.message);
                        hudad.appendTo(hudAds);
                        setTimeout(function(){
                            hudad.fadeOut(300, function() { hudad.remove(); });
                        }, 10000);
                    }catch (e) {
                        console.error(e);
                    }
                })
                processing_check_hud_ad = false;
            });
        }
    }
    function check_room_players() {
        if (!processing_check_room_players && typeof CS_ENV.port !== "undefined" && CS_ENV.port > 0) {
            processing_check_room_players = true;
            $.getJSON('//' + CS_ENV.ORIGIN + "/api2/getRoomPlayers2?port=" + CS_ENV.port + "&region=" + CS_ENV.request_region, function (resp) {
                $.each(resp.data, function (num, player) {
                    try{
                        if (typeof g_PlayerExtraInfo !== "undefined" && typeof g_PlayerExtraInfo[player.player_id] !== "undefined") {
                            g_PlayerExtraInfo[player.player_id].skill = player.skill;
                            g_PlayerExtraInfo[player.player_id].rank = player.rank;
                            g_PlayerExtraInfo[player.player_id].country = player.country;
                            g_PlayerExtraInfo[player.player_id].perks = player.perks;
                            g_PlayerExtraInfo[player.player_id].premium = player.premium;
                            g_PlayerExtraInfo[player.player_id].ping = player.ping;
                            g_PlayerExtraInfo[player.player_id].level = player.level;
                            if (player.voice == 0) {
                                g_PlayerVoiceDisabled[player.player_id] = 0;
                            }
                        }
                    }catch (e) {
                        console.error(e);
                    }
                })
                processing_check_room_players = false;
            });
        } else {
            console.error("check_room_players(): CS_ENV.port is undefined!");
        }
    }
    function check_downloading() {
        if (!processing_check_downloading && typeof CS_ENV.port !== "undefined" && CS_ENV.port > 0) {
            processing_check_downloading = true;
            $.getJSON('//' + CS_ENV.ORIGIN + "/api2/getRoomDownloading?port=" + CS_ENV.port + "&region=" + CS_ENV.request_region, function (resp) {
                $.each(resp.data, function (xash_id, string) {
                    var huddownloading = $("<div class='hud-downloading'>");
                    try {
                        huddownloading.html(string.text);
                        if (string.voice == 0) {
                            g_PlayerVoiceDisabled[xash_id] = 0;
                        }
                        huddownloading.appendTo($(".hud-chat-messages"));
                        setTimeout(function(){
                            huddownloading.fadeOut(300, function() { huddownloading.remove(); });
                        }, 5000);
                    } catch (e) {
                        console.error(e);
                    }
                })
                processing_check_downloading = false;
            });
        } else {
            console.error("check_downloading(): CS_ENV.port is undefined!");
        }
    }

    setInterval(check_hud_ad, 90 * 1000);
    setInterval(check_room_players, 15 * 1000);
    if (CS_ENV.my_cvars['notifications'] === '1') {
        setInterval(check_downloading, 5 * 1000);
    }

    $.when(engineReady).then(function (cvars) {
        try{
            // voice off
        }catch (e) {}
    });

    //Audio suspend/resume
    function addOnBlurListener(onBlurCallback, onFocusCallback) {
        var hidden, visibilityState, visibilityChange; // check the visiblility of the page

        if (typeof document.hidden !== "undefined") {
            hidden = "hidden"; visibilityChange = "visibilitychange"; visibilityState = "visibilityState";
        } else if (typeof document.mozHidden !== "undefined") {
            hidden = "mozHidden"; visibilityChange = "mozvisibilitychange"; visibilityState = "mozVisibilityState";
        } else if (typeof document.msHidden !== "undefined") {
            hidden = "msHidden"; visibilityChange = "msvisibilitychange"; visibilityState = "msVisibilityState";
        } else if (typeof document.webkitHidden !== "undefined") {
            hidden = "webkitHidden"; visibilityChange = "webkitvisibilitychange"; visibilityState = "webkitVisibilityState";
        }


        if (typeof document.addEventListener === "undefined" || typeof hidden === "undefined") {
            // not supported
        } else {
            document.addEventListener(visibilityChange, function() {
                switch (document[visibilityState]) {
                    case "visible":
                        if (onFocusCallback) onFocusCallback();
                        break;
                    case "hidden":
                        if (onBlurCallback) onBlurCallback();
                        break;
                }
            }, false);
        }
    }

    engineReady.then(function(){
        function Muter(SDL2){
            SDL2.audio.scriptProcessorNode.disconnect(SDL2.audioContext.destination);
            this.muteGainNode = SDL2.audioContext.createGain();
            SDL2.audio.scriptProcessorNode
                .connect(this.muteGainNode)
                .connect(SDL2.audioContext.destination);
        }

        Muter.prototype.mute = function(){
            this.muteGainNode.gain.value = 0;
        };

        Muter.prototype.unmute = function(){
            this.muteGainNode.gain.value = 1;
        };

        try{
            var muter = new Muter(SDL2);

            function muteAudio() {
                try{
                    muter.mute();
                }catch (e) {
                    console.error(e);
                }
            }

            function unMuteAudio() {
                try{
                    muter.unmute();
                }catch (e) {
                    console.error(e);
                }
            }

            addOnBlurListener(muteAudio, unMuteAudio);
            $(window).blur(muteAudio);
            $(window).focus(unMuteAudio);
        }catch (e) {
            console.error(e);
        }
    });
});

$(document).ready(function() {
    $.ajaxSetup({xhrFields: { withCredentials: true } });
});

