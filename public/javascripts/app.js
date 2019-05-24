function nodeInc(hash){
    $.ajax({
        type: 'POST',
        url: 'http://10.0.0.21:8580/node/inc',
        data: { hash_code:  hash},
        // type of data we are expecting in return:
        dataType: 'json',
        timeout: 300,
    })
}