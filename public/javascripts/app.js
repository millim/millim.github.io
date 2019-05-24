function nodeInc(hash){
    $.ajax({
        type: 'POST',
        url: 'http://node.yourmillim.com/node/inc',
        data: { hash_code:  hash},
        // type of data we are expecting in return:
        dataType: 'json',
        timeout: 300,
    })
}