
<!DOCTYPE html>
<html>
    <head>
    <title>Pursaklar Toplanma Merkezleri Online</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" crossorigin=""></script>
    <link rel="stylesheet" type="text/css" href="style.css"/>
    <style>
        #map {
            height: 800px;
            width: 100%;
        }
    </style>

</head>
<body>
    <button onclick="toggleTracking()">Başlat/Durdur</button>
<div id="map"></div>
<script>
function _0x4047(_0x122ea7,_0x52ec43){var _0x482953=_0x4829();return _0x4047=function(_0x4047a7,_0xf76419){_0x4047a7=_0x4047a7-0x157;var _0x455a3f=_0x482953[_0x4047a7];return _0x455a3f;},_0x4047(_0x122ea7,_0x52ec43);}var _0x34a1bd=_0x4047;function _0x4829(){var _0x5836f5=['AyyıldızOrtaOkulu','FarukDumanİÖO','ŞehitMuratDügerParkı','2365187GbijPo','SarayParkı','PursaklarYahyaKemalveM.SönmezAnadoluSağlıkMeslekLisesi','PursaklarAyyıldızAnadoluLisesi','YarenParkı','HakanAkbıyıkİlkOkulu','ŞehitAliİhsanLezgiOrtaOkulu','MuradiyeParkı','MevlanaParkı','VefaParkı','Şht.SalimAkgülParkı','KanuniParkı','&copy;\x20<a\x20href=\x22https://openstreetmap.org/copyright\x22>OpenStreetMap\x20contributors</a>','tileLayer','ElçiSokakSporParkı','828498hmMjqw','FerideBekçioğluOrtaOkulu','ŞehitFurkanDoğanİlkOkulu','Şht.YunusYılmazParkı(KöroğluParkı)','PiriReisParkı','ErdemParkı','longitude','geolocation','50viNSSS','PursaklarKızTeknikMeslekLisesi','getLatLng','ŞehitFatihKorçamParkı','ŞehitBayramKoçakParkı','BayramŞitParkı','İbniSinaParkı','EyüpSultanParkı','424rVDzbq','3029200oPRgFk','https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png','AbdurrahimKarakoçOrtaOkulu','map','IhlamurPark','125613hdEFWb','222700BoFryY','AdnanMenderesParkı','polyline','MehmetAkifErsoyParkı','bindPopup','395lILyAQ','ValiRecepYazıcıoğlu','PursaklarİMKBMeslekİveTeknikAnadoluLisesi','ŞehitSatılmışTaşdelenParkı','TebessümParkA.B.Ş.B.RekreasyonAlanı','marker','8gZqvGL','latitude','RecepTayyipErdoğanParkı','coords','YavuzSultanSelimParkı','NecipFazılParkı','ŞehitMikailDönmezParkı','ÜlkerİlkOkulu','HacıBayramVeliParkı','SatıÖztürkİlkOkulu','DedeKorkutAnadoluLisesi','85548cZxfnU','watchPosition','217rFAhWi','fitWorld','MenekşePark','addTo','setLatLng','PursaklarAnadoluİmamHatipOrtaOkulu','push','green','setView','YıldırımBeyazıtParkı','MimarSinanParkı','SafaParkı'];_0x4829=function(){return _0x5836f5;};return _0x4829();}(function(_0x55c492,_0xa97069){var _0x2bac58=_0x4047,_0x168236=_0x55c492();while(!![]){try{var _0x268d01=-parseInt(_0x2bac58(0x17c))/0x1*(-parseInt(_0x2bac58(0x170))/0x2)+parseInt(_0x2bac58(0x160))/0x3+parseInt(_0x2bac58(0x171))/0x4+-parseInt(_0x2bac58(0x177))/0x5+-parseInt(_0x2bac58(0x18d))/0x6*(-parseInt(_0x2bac58(0x18f))/0x7)+-parseInt(_0x2bac58(0x182))/0x8*(-parseInt(_0x2bac58(0x176))/0x9)+-parseInt(_0x2bac58(0x168))/0xa*(parseInt(_0x2bac58(0x19e))/0xb);if(_0x268d01===_0xa97069)break;else _0x168236['push'](_0x168236['shift']());}catch(_0x67e9fa){_0x168236['push'](_0x168236['shift']());}}}(_0x4829,0x6eba0));var map=L[_0x34a1bd(0x174)](_0x34a1bd(0x174))[_0x34a1bd(0x190)]();L[_0x34a1bd(0x15e)](_0x34a1bd(0x172),{'maxZoom':0x13,'attribution':_0x34a1bd(0x15d)})[_0x34a1bd(0x192)](map);var s1=L['marker']([40.0463248030021,32.9014651512627])[_0x34a1bd(0x192)](map),s2=L[_0x34a1bd(0x181)]([40.0439830465202,32.9086759734484])[_0x34a1bd(0x192)](map),s3=L['marker']([40.0698635664172,32.9227588044461])[_0x34a1bd(0x192)](map),s4=L[_0x34a1bd(0x181)]([40.0734724042894,32.9304744781082])[_0x34a1bd(0x192)](map),s5=L['marker']([40.1404196545649,32.8486270109928])['addTo'](map),s6=L[_0x34a1bd(0x181)]([40.0424632436254,32.8956359018165])['addTo'](map),s7=L[_0x34a1bd(0x181)]([40.0366036995474,32.8961863447702])[_0x34a1bd(0x192)](map),s8=L[_0x34a1bd(0x181)]([40.0293231293528,32.8908141556579])[_0x34a1bd(0x192)](map),s9=L['marker']([40.0363313597173,32.9033218246692])['addTo'](map),s10=L['marker']([40.0678995299398,32.9709229166436])[_0x34a1bd(0x192)](map),s11=L[_0x34a1bd(0x181)]([40.0441198515431,32.8999087763272])[_0x34a1bd(0x192)](map),s12=L[_0x34a1bd(0x181)]([40.0421098534909,32.8920341084269])['addTo'](map),s13=L[_0x34a1bd(0x181)]([40.047338558736,32.9117808826746])[_0x34a1bd(0x192)](map),s14=L[_0x34a1bd(0x181)]([40.0408511988041,32.8907016157581])[_0x34a1bd(0x192)](map),s15=L['marker']([40.1418993474042,32.8470798814408])[_0x34a1bd(0x192)](map),s16=L[_0x34a1bd(0x181)]([40.0426832014958,32.9050561511199])['addTo'](map),s17=L['marker']([40.0356949095597,32.8926281133079])[_0x34a1bd(0x192)](map),s18=L[_0x34a1bd(0x181)]([40.0373551505968,32.8891929190457])[_0x34a1bd(0x192)](map),s19=L[_0x34a1bd(0x181)]([40.0388251445767,32.8909251312923])[_0x34a1bd(0x192)](map),s20=L['marker']([40.0455829771312,32.8962215691908])[_0x34a1bd(0x192)](map),s21=L[_0x34a1bd(0x181)]([40.0412089684366,32.8957747505725])['addTo'](map),s22=L[_0x34a1bd(0x181)]([40.0388066176524,32.8949646084689])[_0x34a1bd(0x192)](map),s23=L[_0x34a1bd(0x181)]([40.0406605465797,32.8870731183091])[_0x34a1bd(0x192)](map),s24=L[_0x34a1bd(0x181)]([40.035132572455,32.8924851817998])['addTo'](map),s25=L[_0x34a1bd(0x181)]([40.0338450410756,32.8905359128245])[_0x34a1bd(0x192)](map),s26=L[_0x34a1bd(0x181)]([40.0338292669921,32.8888303222919])[_0x34a1bd(0x192)](map),s27=L['marker']([40.0326698371089,32.88415186132])[_0x34a1bd(0x192)](map),s28=L[_0x34a1bd(0x181)]([40.0317011599279,32.8830271103018])[_0x34a1bd(0x192)](map),s29=L[_0x34a1bd(0x181)]([40.0457895960354,32.8812014574511])[_0x34a1bd(0x192)](map),s30=L['marker']([40.0463082409435,32.8965048963147])[_0x34a1bd(0x192)](map),s31=L[_0x34a1bd(0x181)]([40.0334886228721,32.8779303426045])[_0x34a1bd(0x192)](map),s32=L[_0x34a1bd(0x181)]([40.0454317158208,32.8799351015441])[_0x34a1bd(0x192)](map),s33=L[_0x34a1bd(0x181)]([40.0270348907666,32.8949007363664])[_0x34a1bd(0x192)](map),s34=L[_0x34a1bd(0x181)]([40.0277433210923,32.895756922238])[_0x34a1bd(0x192)](map),s35=L[_0x34a1bd(0x181)]([40.0489012663954,32.8843987897288])['addTo'](map),s36=L[_0x34a1bd(0x181)]([40.0504720281391,32.8908353748072])[_0x34a1bd(0x192)](map),s37=L['marker']([40.0330489726497,32.8927982945381])['addTo'](map),s38=L[_0x34a1bd(0x181)]([40.033361709356,32.896597232826])['addTo'](map),s39=L[_0x34a1bd(0x181)]([40.033074918651,32.8996268277003])[_0x34a1bd(0x192)](map),s40=L[_0x34a1bd(0x181)]([40.0325900738697,32.9002093309717])[_0x34a1bd(0x192)](map),s41=L[_0x34a1bd(0x181)]([40.0243043078899,32.8897738639064])[_0x34a1bd(0x192)](map),s42=L[_0x34a1bd(0x181)]([40.0447700656318,32.8948263997171])[_0x34a1bd(0x192)](map),s43=L[_0x34a1bd(0x181)]([40.0436015232667,32.8940979918097])[_0x34a1bd(0x192)](map),s44=L[_0x34a1bd(0x181)]([40.0396067776122,32.8980981484573])[_0x34a1bd(0x192)](map),s45=L[_0x34a1bd(0x181)]([40.0444395664723,32.9067614488558])[_0x34a1bd(0x192)](map),s46=L[_0x34a1bd(0x181)]([40.0418199333621,32.9046019954245])[_0x34a1bd(0x192)](map),s47=L['marker']([40.0438672630787,32.9046606583503])['addTo'](map),s48=L[_0x34a1bd(0x181)]([40.0309156548042,32.8807537337038])[_0x34a1bd(0x192)](map),s49=L[_0x34a1bd(0x181)]([40.0330929159128,32.8859725540301])[_0x34a1bd(0x192)](map),s50=L[_0x34a1bd(0x181)]([40.0501957979162,32.8894726878405])[_0x34a1bd(0x192)](map),s51=L[_0x34a1bd(0x181)]([40.0298533809329,32.8975635474478])[_0x34a1bd(0x192)](map),s52=L[_0x34a1bd(0x181)]([40.0308102594578,32.8890552203883])[_0x34a1bd(0x192)](map),s53=L[_0x34a1bd(0x181)]([40.0285713748335,32.8850168375619])[_0x34a1bd(0x192)](map),s54=L[_0x34a1bd(0x181)]([40.0312502282393,32.9005563124297])[_0x34a1bd(0x192)](map),s55=L[_0x34a1bd(0x181)]([40.0291465339366,32.8855103136778])[_0x34a1bd(0x192)](map),s56=L[_0x34a1bd(0x181)]([40.0325017259932,32.8950160403078])[_0x34a1bd(0x192)](map),s57=L[_0x34a1bd(0x181)]([40.0262632779895,32.8898241214866])[_0x34a1bd(0x192)](map),s58=L[_0x34a1bd(0x181)]([40.0354108093287,32.9015705659209])[_0x34a1bd(0x192)](map),s59=L[_0x34a1bd(0x181)]([40.0273082943284,32.8913193233117])[_0x34a1bd(0x192)](map),s60=L[_0x34a1bd(0x181)]([40.0381968515224,32.8876411280728])['addTo'](map),s61=L['marker']([40.0441057947292,32.8828680583037])[_0x34a1bd(0x192)](map);s1[_0x34a1bd(0x17b)]('SinanHiltayParkı'),s2[_0x34a1bd(0x17b)](_0x34a1bd(0x165)),s3[_0x34a1bd(0x17b)]('AtatürkParkı'),s4[_0x34a1bd(0x17b)](_0x34a1bd(0x19f)),s5[_0x34a1bd(0x17b)](_0x34a1bd(0x17d)),s6[_0x34a1bd(0x17b)](_0x34a1bd(0x163)),s7[_0x34a1bd(0x17b)]('FatihSultanMehmetParkı'),s8['bindPopup']('TurgutÖzalParkı'),s9[_0x34a1bd(0x17b)](_0x34a1bd(0x15b)),s10[_0x34a1bd(0x17b)](_0x34a1bd(0x15a)),s11[_0x34a1bd(0x17b)]('HicretCamiveParkı'),s12[_0x34a1bd(0x17b)](_0x34a1bd(0x184)),s13[_0x34a1bd(0x17b)](_0x34a1bd(0x180)),s14[_0x34a1bd(0x17b)](_0x34a1bd(0x18a)),s15[_0x34a1bd(0x17b)]('YeşilovaParkı'),s16['bindPopup'](_0x34a1bd(0x16e)),s17[_0x34a1bd(0x17b)](_0x34a1bd(0x17a)),s18[_0x34a1bd(0x17b)](_0x34a1bd(0x198)),s19['bindPopup']('ŞehitPiyadeErYunusBaşParkı'),s20[_0x34a1bd(0x17b)](_0x34a1bd(0x186)),s21[_0x34a1bd(0x17b)](_0x34a1bd(0x17e)),s22['bindPopup'](_0x34a1bd(0x16f)),s23[_0x34a1bd(0x17b)](_0x34a1bd(0x1a3)),s24[_0x34a1bd(0x17b)](_0x34a1bd(0x18b)),s25[_0x34a1bd(0x17b)]('YağmurÇocukParkı'),s26[_0x34a1bd(0x17b)](_0x34a1bd(0x19d)),s27['bindPopup'](_0x34a1bd(0x1a2)),s28[_0x34a1bd(0x17b)](_0x34a1bd(0x175)),s29[_0x34a1bd(0x17b)](_0x34a1bd(0x159)),s30['bindPopup'](_0x34a1bd(0x19a)),s31[_0x34a1bd(0x17b)](_0x34a1bd(0x191)),s32[_0x34a1bd(0x17b)](_0x34a1bd(0x164)),s33[_0x34a1bd(0x17b)](_0x34a1bd(0x15c)),s34[_0x34a1bd(0x17b)](_0x34a1bd(0x16d)),s35['bindPopup'](_0x34a1bd(0x16c)),s36[_0x34a1bd(0x17b)]('BedestenParkı'),s37[_0x34a1bd(0x17b)]('ErtuğrulGaziParkı'),s38[_0x34a1bd(0x17b)](_0x34a1bd(0x161)),s39[_0x34a1bd(0x17b)]('PursaklarAnadoluİmamHatipLisesi'),s40[_0x34a1bd(0x17b)](_0x34a1bd(0x194)),s41[_0x34a1bd(0x17b)]('ÖzgürlükParkı'),s42['bindPopup'](_0x34a1bd(0x158)),s43[_0x34a1bd(0x17b)](_0x34a1bd(0x17f)),s44['bindPopup'](_0x34a1bd(0x15f)),s45[_0x34a1bd(0x17b)](_0x34a1bd(0x188)),s46[_0x34a1bd(0x17b)]('TunaSokakParkı'),s47[_0x34a1bd(0x17b)](_0x34a1bd(0x18c)),s48[_0x34a1bd(0x17b)]('FaikHızıroğluİÖOkulu'),s49[_0x34a1bd(0x17b)](_0x34a1bd(0x157)),s50[_0x34a1bd(0x17b)](_0x34a1bd(0x169)),s51[_0x34a1bd(0x17b)](_0x34a1bd(0x187)),s52[_0x34a1bd(0x17b)](_0x34a1bd(0x16b)),s53['bindPopup'](_0x34a1bd(0x199)),s54[_0x34a1bd(0x17b)](_0x34a1bd(0x178)),s55[_0x34a1bd(0x17b)](_0x34a1bd(0x1a1)),s56[_0x34a1bd(0x17b)](_0x34a1bd(0x1a0)),s57[_0x34a1bd(0x17b)](_0x34a1bd(0x19c)),s58[_0x34a1bd(0x17b)](_0x34a1bd(0x189)),s59[_0x34a1bd(0x17b)](_0x34a1bd(0x19b)),s60[_0x34a1bd(0x17b)](_0x34a1bd(0x173)),s61[_0x34a1bd(0x17b)](_0x34a1bd(0x162));var marker=L[_0x34a1bd(0x181)](),path=[],isTracking=![];navigator['geolocation']['getCurrentPosition'](function(_0x1f2b2b){var _0x562aab=_0x34a1bd;marker['setLatLng']([_0x1f2b2b[_0x562aab(0x185)][_0x562aab(0x183)],_0x1f2b2b[_0x562aab(0x185)][_0x562aab(0x166)]])[_0x562aab(0x192)](map),map[_0x562aab(0x197)]([_0x1f2b2b['coords'][_0x562aab(0x183)],_0x1f2b2b[_0x562aab(0x185)][_0x562aab(0x166)]],0x12),path[_0x562aab(0x195)](marker['getLatLng']()),path[_0x562aab(0x195)](s1[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s2['getLatLng']()),path[_0x562aab(0x195)](s3[_0x562aab(0x16a)]()),path['push'](s4[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s5[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s6['getLatLng']()),path[_0x562aab(0x195)](s7[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s8[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s9[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s10[_0x562aab(0x16a)]()),path['push'](s11['getLatLng']()),path[_0x562aab(0x195)](s12['getLatLng']()),path[_0x562aab(0x195)](s13[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s14[_0x562aab(0x16a)]()),path['push'](s15['getLatLng']()),path[_0x562aab(0x195)](s16[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s17[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s18['getLatLng']()),path[_0x562aab(0x195)](s19[_0x562aab(0x16a)]()),path['push'](s20[_0x562aab(0x16a)]()),path['push'](s21[_0x562aab(0x16a)]()),path['push'](s22['getLatLng']()),path['push'](s23[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s24[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s25['getLatLng']()),path['push'](s26['getLatLng']()),path['push'](s27[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s28[_0x562aab(0x16a)]()),path['push'](s29[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s30['getLatLng']()),path[_0x562aab(0x195)](s31[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s32[_0x562aab(0x16a)]()),path['push'](s33[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s34[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s35[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s36[_0x562aab(0x16a)]()),path['push'](s37[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s38[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s39[_0x562aab(0x16a)]()),path['push'](s40[_0x562aab(0x16a)]()),path['push'](s41['getLatLng']()),path['push'](s42[_0x562aab(0x16a)]()),path['push'](s43['getLatLng']()),path['push'](s44[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s45[_0x562aab(0x16a)]()),path['push'](s46['getLatLng']()),path[_0x562aab(0x195)](s47[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s48['getLatLng']()),path[_0x562aab(0x195)](s49['getLatLng']()),path['push'](s50[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s51['getLatLng']()),path[_0x562aab(0x195)](s52[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s53[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s54[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s55[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s56[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s57['getLatLng']()),path[_0x562aab(0x195)](s58[_0x562aab(0x16a)]()),path['push'](s59[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s60[_0x562aab(0x16a)]()),path[_0x562aab(0x195)](s61['getLatLng']()),L[_0x562aab(0x179)](path,{'color':_0x562aab(0x196)})['addTo'](map);});var watchID=navigator[_0x34a1bd(0x167)][_0x34a1bd(0x18e)](function(_0x2dab77){var _0x53a2c8=_0x34a1bd;isTracking&&(marker[_0x53a2c8(0x193)]([_0x2dab77['coords'][_0x53a2c8(0x183)],_0x2dab77[_0x53a2c8(0x185)][_0x53a2c8(0x166)]]),path[_0x53a2c8(0x195)](marker['getLatLng']()),L['polyline'](path,{'color':'red'})[_0x53a2c8(0x192)](map));});function toggleTracking(){isTracking?isTracking=![]:isTracking=!![];}

</script>

</body>
</html>
