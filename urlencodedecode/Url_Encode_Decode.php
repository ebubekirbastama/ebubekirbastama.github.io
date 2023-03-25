<html><head>
    <title>Veri Kodlama ve Parçalama</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/css/bootstrap.min.css">
        <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.6.3/jquery.min.js"></script>
        <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.4.1/js/bootstrap.min.js"></script>
        <style>
            body {
                background-image: url(https://images.pexels.com/photos/3137052/pexels-photo-3137052.jpeg);
                background-repeat: no-repeat;
                background-size: cover;
            }
        </style>
    </head>
    <body>
    <div class="container">
        <h2>EBS Url Encode ve Decode</h2>
        <textarea id="veri" rows="5" cols="150"></textarea>
        <br>
        <br>
        <button onclick="EBSurlEncode()" class="btn btn-info">Url Encode Et</button>
        <button onclick="EBSurlDecode()" class="btn btn-success">Url Decode Et</button>
        <br>
        <br>
        <textarea id="sonuc" rows="5" cols="150"></textarea>
    </div>
    <script>

    (function(_0x3bf092,_0x1cea32){const _0x153ffb=_0x4a98,_0x317069=_0x3bf092();while(!![]){try{const _0x1b539c=-parseInt(_0x153ffb(0x1ab))/0x1+parseInt(_0x153ffb(0x1b9))/0x2*(parseInt(_0x153ffb(0x1b1))/0x3)+parseInt(_0x153ffb(0x1b0))/0x4*(parseInt(_0x153ffb(0x1bc))/0x5)+-parseInt(_0x153ffb(0x1b5))/0x6+-parseInt(_0x153ffb(0x1ba))/0x7*(parseInt(_0x153ffb(0x1ae))/0x8)+parseInt(_0x153ffb(0x1b8))/0x9+parseInt(_0x153ffb(0x1ad))/0xa;if(_0x1b539c===_0x1cea32)break;else _0x317069['push'](_0x317069['shift']());}catch(_0x61c02e){_0x317069['push'](_0x317069['shift']());}}}(_0x1810,0x83537));function EBSurlEncode(){const _0x3e1697=_0x4a98;let _0x9ed3e9=document[_0x3e1697(0x1b3)](_0x3e1697(0x1b4)),_0x4bc92b=document[_0x3e1697(0x1b3)](_0x3e1697(0x1ac));_0x4bc92b[_0x3e1697(0x1af)]=0x5,_0x4bc92b[_0x3e1697(0x1be)]=0x96;let _0x5814f1=encodeURI(_0x9ed3e9[_0x3e1697(0x1b7)]);_0x4bc92b[_0x3e1697(0x1b7)]=_0x5814f1,_0x9ed3e9[_0x3e1697(0x1bb)][_0x3e1697(0x1b6)](_0x4bc92b,_0x9ed3e9[_0x3e1697(0x1b2)]);}function _0x4a98(_0x5702a2,_0x71e2a6){const _0x18105d=_0x1810();return _0x4a98=function(_0x4a98cc,_0x19abbf){_0x4a98cc=_0x4a98cc-0x1ab;let _0x4e147c=_0x18105d[_0x4a98cc];return _0x4e147c;},_0x4a98(_0x5702a2,_0x71e2a6);}function EBSurlDecode(){const _0x4de741=_0x4a98;let _0x3610cc=document['getElementById'](_0x4de741(0x1b4)),_0x2e516a=document['getElementById']('sonuc');_0x2e516a[_0x4de741(0x1af)]=0x5,_0x2e516a['cols']=0x96;let _0x2844b0=_0x3610cc[_0x4de741(0x1b7)],_0x44ddde=decodeURI(_0x2844b0);_0x2e516a['value']=JSON[_0x4de741(0x1bd)](_0x44ddde,null,0x2),_0x3610cc[_0x4de741(0x1bb)]['insertBefore'](_0x2e516a,_0x3610cc[_0x4de741(0x1b2)]);}function _0x1810(){const _0x1fa078=['3213boldgi','parentNode','231730drUPRz','stringify','cols','477586iZrHOu','sonuc','12279580ncLtwy','15896ZQJnaW','rows','52GigCBy','3NysAxJ','nextSibling','getElementById','veri','818604LIyYUh','insertBefore','value','2005353EsUlGM','21382HyDeDR'];_0x1810=function(){return _0x1fa078;};return _0x1810();}

    </script>
</body>
</html>
