

function curlToPHP(curl) {
    var err = 'if (curl_errno($ch)) {\n    echo \'Error:\' . curl_error($ch);\n}\n';
    var endCurl = 'curl_close($ch);\n';
    var promo = "// Ebubekir Bastama https://www.ebubekirbastama.com";
    var start = "$ch = curl_init();\n\n";
    var result = '$result = curl_exec($ch);';


    var boolOptions = ['#', 'progress-bar', '-', 'next', '0', 'http1.0', 'http1.1', 'http2',
        'no-npn', 'no-alpn', '1', 'tlsv1', '2', 'sslv2', '3', 'sslv3', '4', 'ipv4', '6', 'ipv6',
        'a', 'append', 'anyauth', 'B', 'use-ascii', 'basic', 'compressed', 'create-dirs',
        'crlf', 'digest', 'disable-eprt', 'disable-epsv', 'environment', 'cert-status',
        'false-start', 'f', 'fail', 'ftp-create-dirs', 'ftp-pasv', 'ftp-skip-pasv-ip',
        'ftp-pret', 'ftp-ssl-ccc', 'ftp-ssl-control', 'g', 'globoff', 'G', 'get',
        'ignore-content-length', 'i', 'include', 'I', 'head', 'j', 'junk-session-cookies',
        'J', 'remote-header-name', 'k', 'insecure', 'l', 'list-only', 'L', 'location',
        'location-trusted', 'metalink', 'n', 'netrc', 'N', 'no-buffer', 'netrc-file',
        'netrc-optional', 'negotiate', 'no-keepalive', 'no-sessionid', 'ntlm', 'O',
        'remote-name', 'oauth2-bearer', 'p', 'proxy-tunnel', 'path-as-is', 'post301', 'post302',
        'post303', 'proxy-anyauth', 'proxy-basic', 'proxy-digest', 'proxy-negotiate',
        'proxy-ntlm', 'q', 'raw', 'remote-name-all', 's', 'silent', 'sasl-ir', 'S', 'show-error',
        'ssl', 'ssl-reqd', 'ssl-allow-beast', 'ssl-no-revoke', 'socks5-gssapi-nec', 'tcp-nodelay',
        'tlsv1.0', 'tlsv1.1', 'tlsv1.2', 'tr-encoding', 'trace-time', 'v', 'verbose', 'xattr',
        'h', 'help', 'M', 'manual', 'V', 'version'];

    if (!curl.trim())
        return;
    var cmd = parseCommand(curl, {boolFlags: boolOptions});

    if (cmd._[0] != "curl")
        throw "curl komutu değil !";

    var req = extractRelevantPieces(cmd);

    var code = promo + "\n" + start;
    code += 'curl_setopt($ch, CURLOPT_URL, ' + phpExpandEnv(req.url) + ');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);\n';

   
    if (req.headers.length == 0 && !req.data.ascii && !req.data.files && !req.data.multipart && !req.basicauth && !req.compressed) {
        return code + renderSimple(req.method);
    } else {
        return code + renderComplex(req);
    }


    function renderSimple(method) {
        var php = "";
        if (method == "POST")
            php = 'curl_setopt($ch, CURLOPT_POST, 1);\n';
        else if (method == "HEAD")
            php = 'curl_setopt($ch, CURLOPT_CUSTOMREQUEST, \'HEAD\');\ncurl_setopt($ch, CURLOPT_NOBODY, true);\n';
        else if (method != "GET")
            php = 'curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ' + phpExpandEnv(method) + ');\n';

        return php + '\n' + result + '\n' + err + endCurl;
    }


    function renderComplex(req) {
        var php = "";

        var headers = {};
        for (var i = 0; i < req.headers.length; i++) {
            var split = req.headers[i].indexOf(":");
            if (split == -1)
                continue;
            var name = req.headers[i].substr(0, split).trim();
            var value = req.headers[i].substr(split + 1).trim();
            headers[toTitleCase(name)] = value;
        }

        if (req.method == "POST")
            php += 'curl_setopt($ch, CURLOPT_POST, 1);\n';
        else if (req.method == "HEAD")
            php += 'curl_setopt($ch, CURLOPT_CUSTOMREQUEST, \'HEAD\');\ncurl_setopt($ch, CURLOPT_NOBODY, true);\n';
        else
            php += 'curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ' + phpExpandEnv(req.method) + ');\n\n';

        var defaultPayloadVar = "$body";
        if (req.data.ascii || req.data.files || req.data.multipart) {
            var ioReaders = [];

            if (req.data.ascii) {
                var stringBody = function () {
                    ioReaders.push(JSON.stringify(req.data.ascii));
                }

                /*
                 * TODO - write jsonToPHP
                 if (headers["Content-Type"] && headers["Content-Type"].indexOf("json") > -1) {
                 // create a struct for the JSON
                 var result = jsonToGo(req.data.ascii, "Payload");
                 if (result.error)
                 stringBody(); // not valid JSON, so just treat as a regular string
                 else if (result.go) {
                 // valid JSON, so create a struct to hold it
                 php += result.go+'\n\ndata := Payload{\n\t// fill struct\n}\n';
                 php += 'payloadBytes, err := json.Marshal(data)\n'+err;
                 php += defaultPayloadVar+' := bytes.NewReader(payloadBytes)\n\n';
                 }
                 } else {
                 */
                // not a json Content-Type, so treat as string
                stringBody();
                //}
            }

            // if file data...
            if (req.data.files && req.data.files.length > 0) {
                var varName = "file";
                for (var i = 0; i < req.data.files.length; i++) {
                    var thisVarName = (req.data.files.length > 1 ? varName + (i + 1) : varName);
                    ioReaders.push('\'' + thisVarName + '\' => \'@\' .realpath(' + phpExpandEnv(req.data.files[i]) + ')');
                }
            }

            // if multipart data...
            if (req.data.multipart && req.data.multipart.length > 0) {
                for (var i = 0; i < req.data.multipart.length; i++) {
                    var arg = req.data.multipart[i];

                    var argSplit = arg.indexOf("=");
                    if (argSplit > -1) {
                        var argValue = arg.substr(argSplit + 1);
                        var argName = arg.substr(0, argSplit);
                        if (argValue.startsWith("@")) { //if it a file
                            ioReaders.push('\'' + argName + '\' => \'@\' .realpath(' + phpExpandEnv(argValue.substr(1)) + ')');
                        } else {
                            ioReaders.push('\'' + argName + '\' => ' + phpExpandEnv(argValue));
                        }
                    }
                }
            }

            // render PHP code to put all the data in the body, concatenating if necessary
            if (ioReaders.length == 1 && typeof varName == 'undefined') {
                //If variable have code ".. -d attributes='{...", delete quotes.
                ioReaders[0] = ioReaders[0].replace(/\=[\'\"]\{([^$]+)\}[\'\"]/, '={$1}');
                php += 'curl_setopt($ch, CURLOPT_POSTFIELDS, ' + ioReaders[0] + ');\n';
            } else if (ioReaders.length > 0) {
                php += '$post = array(\n    ';
                // KNOWN ISSUE: The way we separate file and ascii data values
                // loses the order between them... our code above just puts the
                // ascii values first, followed by the files.
                php += ioReaders.join(",\n    ");
                php += '\n);\n';
                php += 'curl_setopt($ch, CURLOPT_POSTFIELDS, $post);\n';
            }
        }

        // set basic auth
        if (req.basicauth) {
            php += 'curl_setopt($ch, CURLOPT_USERPWD, ' + phpExpandEnv(req.basicauth.user) + ' . \':\' . ' + phpExpandEnv(req.basicauth.pass) + ');\n';
        }

        // set compressed
        if (req.compressed) {
            php += 'curl_setopt($ch, CURLOPT_ENCODING, \'gzip, deflate\');\n';
        }

        // set headers
        for (var name in headers) {
            if (typeof phpHeader == 'undefined') {
                phpHeader = '\n$headers = array();\n';
            }
            phpHeader += '$headers[] = ' + phpExpandEnv(name).slice(0, -1) + ': ' + phpExpandEnv(headers[name]).slice(1) + ';\n';
        }
        if (typeof phpHeader != 'undefined') {
            php += phpHeader + 'curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n';
        }
        delete phpHeader;

        // complete request
        php += '\n' + result + '\n' + err + endCurl

        return php;
    }


    function extractRelevantPieces(cmd) {
        var relevant = {
            url: "",
            method: "",
            headers: [],
            data: {}
        };

        if (cmd.url && cmd.url.length > 0)
            relevant.url = cmd.url[0]
        else if (cmd._.length > 1)
            relevant.url = cmd._[1];

        if (cmd.H)
            relevant.headers = relevant.headers.concat(cmd.H);
        if (cmd.header)
            relevant.headers = relevant.headers.concat(cmd.header);

        if (cmd.I || cmd.head)
            relevant.method = "HEAD";

        if (cmd.request && cmd.request.length > 0)
            relevant.method = cmd.request[cmd.request.length - 1].toUpperCase();
        else if (cmd.X && cmd.X.length > 0)
            relevant.method = cmd.X[cmd.X.length - 1].toUpperCase(); // if multiple, use last (according to curl docs)

        // join multiple request body data, if any
        var dataAscii = [];
        var dataMultipart = [];
        var dataFiles = [];
        var loadData = function (d, multipart) {
            if (!relevant.method)
                relevant.method = "POST";

            var hasContentType = false;
            for (var i = 0; i < relevant.headers.length; i++) {
                if (toTitleCase(relevant.headers[i]).indexOf("Content-Type") == 0) {
                    hasContentType = true;
                    break;
                }
            }
            if (!hasContentType && !multipart)
                relevant.headers.push("Content-Type: application/x-www-form-urlencoded");

            for (var i = 0; i < d.length; i++)
            {
                if (multipart)
                    dataMultipart.push(d[i]);
                else if (d[i].length > 0 && d[i][0] == "@")
                    dataFiles.push(d[i].substr(1));
                else
                    dataAscii.push(d[i]);
            }
        };
        if (cmd.d)
            loadData(cmd.d);
        if (cmd.data)
            loadData(cmd.data);
        if (cmd['data-raw'])
            loadData(cmd['data-raw']);
        if (cmd['data-binary'])
            loadData(cmd['data-binary']);
        if (cmd.F)
            loadData(cmd.F, true);
        if (cmd.form)
            loadData(cmd.form, true);

        if (dataAscii.length > 0)
            relevant.data.ascii = dataAscii.join("&");

        if (dataMultipart.length > 0)
            relevant.data.multipart = dataMultipart;

        if (dataFiles.length > 0)
            relevant.data.files = dataFiles;
        if (cmd.compressed)
            relevant.compressed = true;

        var basicAuthString = "";
        if (cmd.user && cmd.user.length > 0)
            basicAuthString = cmd.user[cmd.user.length - 1];
        else if (cmd.u && cmd.u.length > 0)
            basicAuthString = cmd.u[cmd.u.length - 1];
        var basicAuthSplit = basicAuthString.indexOf(":");
        if (basicAuthSplit > -1) {
            relevant.basicauth = {
                user: basicAuthString.substr(0, basicAuthSplit),
                pass: basicAuthString.substr(basicAuthSplit + 1)
            };
        } else {
            relevant.basicAuth = {user: basicAuthString, pass: "<PASSWORD>"};
        }

        if (!relevant.method)
            relevant.method = "GET";

        return relevant;
    }

    function toTitleCase(str) {
        return str.replace(/\w*/g, function (txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    function phpExpandEnv(s) {
        var pos = s.indexOf("$");
        if (pos > -1)
        {
            if (pos > 0 && s[pos - 1] == '\\') {

                s = s.substr(0, pos - 1) + s.substr(pos);
            } else {

                return '$_ENV["' + phpEsc(s).replace(/\$/g, '') + '"]';
            }
        }
        return '\'' + phpEsc(s) + '\'';
    }

    function phpEsc(s) {
        return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }
}


function parseCommand(input, options) {
    if (typeof options === 'undefined') {
        options = {};
    }

    var result = {_: []}, // what we return
            cursor = 0, // iterator position
            token = "";       // current token (word or quoted string) being built

    input = input.trim();
    if (input.length > 2 && (input[0] == '$' || input[0] == '#') && whitespace(input[1]))
        input = input.substr(1).trim();

    for (cursor = 0; cursor < input.length; cursor++) {
        skipWhitespace();
        if (input[cursor] == "-") {
            flagSet();
        } else {
            unflagged();
        }
    }

    return result;

    function flagSet() {

        if (cursor < input.length - 1 && input[cursor + 1] == "-") {
            return longFlag();
        }

        cursor++;
        while (cursor < input.length && !whitespace(input[cursor]))
        {
            var flagName = input[cursor];
            if (typeof result[flagName] == 'undefined') {
                result[flagName] = [];
            }
            cursor++; // skip the flag name
            if (boolFlag(flagName))
                result[flagName] = true;
            else if (Array.isArray(result[flagName]))
                result[flagName].push(nextString());
        }
    }


    function longFlag() {
        cursor += 2;
        var flagName = nextString("=");
        if (boolFlag(flagName))
            result[flagName] = true;
        else {
            if (typeof result[flagName] == 'undefined') {
                result[flagName] = [];
            }
            if (Array.isArray(result[flagName])) {
                result[flagName].push(nextString());
            }
        }
    }

    function unflagged() {
        result._.push(nextString());
    }

    function boolFlag(flag) {
        if (Array.isArray(options.boolFlags)) {
            for (var i = 0; i < options.boolFlags.length; i++) {
                if (options.boolFlags[i] == flag)
                    return true;
            }
        }
        return false;
    }

    function nextString(endChar) {
        skipWhitespace();

        var str = "";

        var quoted = false,
                quoteCh = "",
                escaped = false;

        if (input[cursor] == '"' || input[cursor] == "'") {
            quoted = true;
            quoteCh = input[cursor];
            cursor++;
        }

        for (; cursor < input.length; cursor++) {
            if (quoted) {
                if (input[cursor] == quoteCh && !escaped) {
                    quoted = false;
                    continue;
                }
            }
            if (!quoted) {
                if (!escaped) {
                    if (whitespace(input[cursor])) {
                        return str;
                    }
                    if (endChar && input[cursor] == endChar) {
                        cursor++; // skip the endChar
                        return str;
                    }
                }
            }
            if (!escaped && input[cursor] == "\\") {
                escaped = true;
                // skip the backslash unless the next character is $
                if (!(cursor < input.length - 1 && input[cursor + 1] == '$'))
                    continue;
            }

            str += input[cursor];
            escaped = false;
        }

        return str;
    }

    function skipWhitespace() {
        for (; cursor < input.length; cursor++) {
            while (input[cursor] == "\\" && (cursor < input.length - 1 && whitespace(input[cursor + 1])))
                cursor++;
            if (!whitespace(input[cursor]))
                break;
        }
    }

    function whitespace(ch) {
        return ch == " " || ch == "\t" || ch == "\n" || ch == "\r";
    }
}
