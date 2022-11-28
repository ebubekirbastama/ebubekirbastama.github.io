$(function ()
{
    var emptyOutputMsg = "PHP kodu burada görünecek";
    var formattedEmptyOutputMsg = '<span style="color: #777;">' + emptyOutputMsg.replace("^^", "") + '</span>';


    $('#input').on('focus', function () {
        if (!$(this).val())
            $('#output').html(formattedEmptyOutputMsg);
    });

    // Shows placeholder text
    $('#input').on('blur', function () {
        if (!$(this).val())
            $('#output').html(formattedEmptyOutputMsg);
    }).blur();

    // Otomatik Curl Oluşturma
    $('#input').keyup(function ()
    {


        var input = $(this).val().toString();

        var input2 = "";
        for (var i = 0; i < input.split('^').length; i++) {
            input2 += input.split('^')[i];
        }
        input = input2;
        if (!input)
        {

            $('#output').html(formattedEmptyOutputMsg);
            return;
        }

        try {
            var output = curlToPHP(input);
            if (output) {
                var coloredOutput = hljs.highlight("php", output);
                $('#output').html(coloredOutput.value);
            }
        } catch (e) {
            $('#output').html('<span class="clr-red">' + e + '</span>');
        }
    });

    $('#output').click(function ()
    {
        if (document.selection)
        {
            var range = document.body.createTextRange();
            range.moveToElementText(this);
            range.select();
        } else if (window.getSelection)
        {
            var range = document.createRange();
            range.selectNode(this);
            window.getSelection().addRange(range);
        }
    });


});
