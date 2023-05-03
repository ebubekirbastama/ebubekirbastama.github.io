// JavaScript açık mı kontrol et
var isJavaScriptEnabled = true;
var noscriptElement = document.getElementsByTagName("noscript")[0];
if (noscriptElement) {
    isJavaScriptEnabled = false;
}

if (isJavaScriptEnabled) {
    // Kullanıcının IP adresini almak için Ajax isteği gönderiyoruz
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://api.ipify.org/?format=json", true);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            var data = JSON.parse(xhr.responseText);
            var ipAddress = data.ip;

            // Kullanıcının user agent bilgisini alıyoruz
            var userAgent = navigator.userAgent;

            // Bilgileri sunucuya gönderiyoruz
            var userInfo = {
                ipAddress: ipAddress,
                userAgent: userAgent
            };

            // Değişkenleri sorgu parametreleri olarak ekleyerek isteği gönderiyoruz
            var searchParams = new URLSearchParams(userInfo);
            var requestUrl = "https://www.ebubekirbastama.com/search?" + searchParams.toString();
            var xhr2 = new XMLHttpRequest();
            xhr2.open("GET", requestUrl, true);
            xhr2.onreadystatechange = function () {
                if (xhr2.readyState === 4 && xhr2.status === 200) {
                    console.log(xhr2.responseText);
                }
            };
            xhr2.send();
        }
    };
    xhr.send();
} else {
    // JavaScript kapalıysa sayfayı kapat
    window.close();
}
