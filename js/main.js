/* xymondash - get a concise view of a crowded xymon instance
   (c) 2018 ISG D-PHYS, ETHZ
       Claude Becker    - backend code
       Sven Mäder       - Visual FX
       Christian Herzog - Javascript logic

*/

let colors = ['red', 'yellow', 'purple', 'blue'];   //sync w/ URL
let prios = ['p1', 'p2', 'p3', 'p4', 'ack'];        //make ack toggable

let dialogForm, dialogPopup, backgroundColor;
let paused = false;

$(document).ready(function(){
    $(document).tooltip({                         //initialize tooltips
        items: "[tooltip]",
        content: function() {
            let msg = $(this).attr('tooltip').replace(/\\+n/g, 'LBRK').replace(/\\[p|t]/g, '  ')
                .replace(/(&(red|green|yellow|clear) )/g, '<span style="color: $2;">&#x25cf; </span>');
            let lines = msg.split(/LBRK/);
            let res = lines.slice(0, 18).join('<br />');
            if (lines.length > 18) {
                res += '<br />...';
            }
            return res;
        },
        open: function(event, ui) {
            paused = true;
        },
        close: function(event, ui) {
            paused = false;
        },
        position: { my: "center top", at: "left bottom", collision: "flipfit" },
        classes: {
           "ui-tooltip": "ui-widget-shadow"
        }
    });

    dialogForm = $( "#dialog-form" ).dialog({       //acknowledge form template
      autoOpen: false,
      height: 300,
      width: 350,
      modal: true,
      buttons: {
        "Acknowledge test": ackTest,
        Cancel: function() {
          dialogForm.dialog( "close" );
        }
      },
      open: function() {
          let options = $( "#dialog-form" ).dialog( "option" );
          let cookie = options.cookie;
          $("#number").val(cookie);
          let hostname = options.hostname;
          $("#hostname").val(hostname);
          let testname = options.testname;
          $("#testname").val(testname);
      }
    });

    dialogPopup = $( "#dialog-popup" ).dialog({     //acknowledge msg popup
      autoOpen: false,
      modal: false,
      close: function() {
      },
      open: function() {
          let options = $( "#dialog-popup" ).dialog( "option" );
          let ackmsg = options.ackmsg;
          $("#ackmsg-popup").html(ackmsg);
      }
    });

    processData();              //fetch data and fill matrix

    setInterval(function() {    //reload every 30s
        if (!paused) { processData() };
    }, 30000);
});

function processData() {
    let xymonData;
    let bullets = {};
    let lowestPos = {};
    let hostExists = {};
    let params = '';
    if ($.urlParam()) {
        params = '?'+$.urlParam();
    }
    backgroundColor = "green";
    xymonData = getJSON('https://xymon.phys.ethz.ch/xymonjs/cgi/xymon2json'+params);
    xymonData.forEach(function(entry) {     //loop thru data and process it into bullets object
        let host = entry.hostname.trim();
        let test = entry.testname.trim();
        let color = entry.color.trim();
        let msg = entry.msg.trim();
        let prioString = entry.XMH_CLASS.match(/_P(\d)_/);
        let prio, ackmsg, acktime, cookie;
        if (prioString) {
            prio = 'p' + prioString[1].trim();
        } else {
            prio = 'p4';
        }
        if (entry.ackmsg) {
            ackmsg = entry.ackmsg;
            acktime = entry.acktime;
            prio = 'ack';
        } else {
            ackmsg = 'empty';
            acktime = '';
        }
        if (entry.cookie) {
            cookie = entry.cookie;
        } else {
            cookie = 'empty';
        }
        if (host && test && color && prio) {
            if (!bullets[color]) bullets[color] = {};
            if (!bullets[color][prio]) bullets[color][prio] = {};
            if (!bullets[color][prio][host]) bullets[color][prio][host] = {};
            if (!bullets[color][prio][host][test]) bullets[color][prio][host][test] = {};
            bullets[color][prio][host][test]['ackmsg'] = ackmsg;
            bullets[color][prio][host][test]['acktime'] = acktime;
            bullets[color][prio][host][test]['cookie'] = cookie;
            bullets[color][prio][host][test]['msg'] = msg;
            lowestPos[host] = {};
            lowestPos[host]['x'] = 10;
            lowestPos[host]['y'] = 10;
        }
        if (prio == 'p1') {
            background(color);
        }
    });


    let x = 0;
    let y = 0;
    colors.forEach(function(color) {        //build up matrix and display bullets data
        prios.forEach(function(prio) {
            var sel = color + '_' + prio;   //clean up old stuff
            $('#' + sel).html('');
            $('#' + sel).addClass("inv");
            let pos = x + 10*y;             //our 'severity position' in the prio/color matrix
            if (bullets[color] && bullets[color][prio]) {
                let hosts = bullets[color][prio];
                let keys = Object.keys(hosts);
                keys.sort();
                for (i = 0; i < keys.length; i++) {
                    host = keys[i];
                    for (let test in bullets[color][prio][host]) {
                        let ackmsg = bullets[color][prio][host][test]['ackmsg'];
                        let acktime = bullets[color][prio][host][test]['acktime'];
                        let msg = bullets[color][prio][host][test]['msg'];
                        let cookie = bullets[color][prio][host][test]['cookie'];
                        let lowestX = lowestPos[host]['x'];
                        let lowestY = lowestPos[host]['y'];
                        let lowestPosHost = lowestX + 10*lowestY;
                        let selector;
                        if (lowestPosHost < pos) {    //if we have a higher prio/color entry already
                            selector = colors[lowestY] + '_' + prios[lowestX];
                        } else {
                            selector = color + '_' + prio;
                            lowestPos[host]['x'] = x;
                            lowestPos[host]['y'] = y;
                        }
                        var ackClass = (ackmsg != 'empty')?' acked':'';
                        ackmsg = ackmsg.replace(/\\n/ig, "<br />");
                        let d = new Date(acktime*1000);
                        acktime = "acked until " + dateFormat(d, "HH:MM, mmmm d (dddd)");
                        ackmsg = '<b>'+ackmsg+'</b><br /><br />'+acktime;
                        if (hostExists[host]) {   //just add another test
                            $('[data-host='+host+']').append(" \
                                <div class='tests'><span class='test"+ackClass+"' data-test='"+test
                                +"' data-ackmsg='"+escape(ackmsg)+"' data-cookie='"
                                +cookie+"' >"+test+"</span>\
                                <i class='ack fas fa-check' id='"+cookie+"'></i>\
                            </div> ");
                            $('[data-cookie='+cookie+']').attr('tooltip', msg);
                            if (ackmsg != 'empty') {
                                $('i#'+cookie).attr('tooltip', ackmsg);
                            }
                        } else {                  //we need a host entry first
                            $("#" + selector).append("<div class='msg' data-host='"+host+"' >\
                                <span class='info'>"+host+": </span><div class='tests'> \
                                <span class='test"+ackClass+"' data-test='"+test+"' data-ackmsg='"
                                +escape(ackmsg)+"' data-cookie='"+cookie
                                +"'>"+test+"</span>\
                                <i class='ack fas fa-check' id='"+cookie+"'></i></div>\
                            </div>");
                            $("#" + selector).removeClass("inv");
                            $('[data-cookie='+cookie+']').attr('tooltip', msg);
                            if (ackmsg != 'empty') {
                                $('i#'+cookie).attr('tooltip', ackmsg);
                            }

                            hostExists[host] = 1;
                        }
                    }
                }
            }
            x++;
        });
        x = 0;
        y++;
    });
    setBackgroundColor();

    $("span.info").click(function(){
        $(this).innerHTML = $(this).parent().parent().data("host")+' / ';
        let link = createLink($(this).parent().data("host"), 'info');
        window.open(link,"_self")
    });
    $("span.test").click(function(){
        let link = createLink($(this).parent().parent().data("host"), $(this).data("test"));
        window.open(link,"_self")
    });
    $("div.tests").mouseenter(function(){
        $(this).children("i.ack").css("visibility", "visible");
    });
    $("div.tests").mouseleave(function(){
        $(this).children("i.ack").css("visibility", "hidden");
    });
    $("i.ack").click(function(){
        if (!$(this).parent().children("span.test").prop("class").match(/\backed\b/)) {
            dialogForm.dialog("option", "cookie", $(this).parent().children("span.test").data("cookie"));
            dialogForm.dialog("option", "hostname", $(this).parent().parent().data("host"));
            dialogForm.dialog("option", "testname", $(this).parent().children("span.test").data("test"));
            dialogForm.dialog("open");
        } else {
            dialogPopup.dialog("option", "ackmsg", unescape($(this).parent().children("span.test").data("ackmsg")));
            dialogPopup.dialog("open");
        }
    });
}

function createLink(host, test) {
    return 'https://xymon.phys.ethz.ch/xymon-cgi/svcstatus.sh?HOST='
        +host+'&SERVICE='+test;
}

function getJSON(url) {
    let resp ;
    let xmlHttp ;

    resp  = '' ;
    xmlHttp = new XMLHttpRequest();

    if(xmlHttp != null) {
        xmlHttp.withCredentials = true;
        xmlHttp.open( "GET", url, false );
        xmlHttp.setRequestHeader('cache-control', 'no-cache, must-revalidate, post-check=0, pre-check=0');
        xmlHttp.setRequestHeader('cache-control', 'max-age=0');
        xmlHttp.setRequestHeader('expires', '0');
        xmlHttp.setRequestHeader('expires', 'Tue, 01 Jan 1980 1:00:00 GMT');
        xmlHttp.setRequestHeader('pragma', 'no-cache');

        xmlHttp.send(null);
        resp = xmlHttp.responseText;
    }

    return JSON.parse(resp);
}

function ackTest() {
    var fields = ['number', 'delay', 'message'];
    var vals = {};
    fields.forEach(function(field) {
        vals[field] = $("#"+field).val().trim();
    });

    $.ajax({
        type: "POST",
        url: "https://xymon.phys.ethz.ch/xymonjs/cgi/xymon-ack ",
        data: { number: vals['number'], min: vals['delay'], msg: vals['message'] },
        success: function( data ) {
            dialogForm.dialog( "close" );
            processData();
        },
    });
}

$.urlParam = function(){
    let result = '';
    if (result = window.location.href.match(/\?(.*)$/)) {
        return result[1];
    } else {
        return null;
    }
}

function keys(obj) {
    var keys = [];
    for(var key in obj) {
        if(obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }

    return keys;
}

function background(color) {
    if (backgroundColor == 'red') {
        return;
    } else if (backgroundColor == 'purple') {
        if (color == 'red') {
            backgroundColor = color;
        }
    } else if (backgroundColor == 'yellow') {
        if ((color == 'red') || (color == 'purple')) {
            backgroundColor = color;
        }
    } else if (backgroundColor == 'blue') {
        if ((color == 'red') || (color == 'purple') || (color == 'yellow')) {
            backgroundColor = color;
        }
    } else {
            backgroundColor = color;
    }
}

function setBackgroundColor() {
    $('#bg').fadeOut(250, function() {
        $('#bg').removeClass();
        $('#bg').addClass('bg-' + backgroundColor);
        $('#bg').fadeIn(250);
    });
}
