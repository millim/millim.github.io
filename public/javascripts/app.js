function nodeInc(hash){
    $.ajax({
        type: 'POST',
        url: 'https://node.yourmillim.com/node/inc',
        data: { hash_code:  hash},
        // type of data we are expecting in return:
        dataType: 'json',
        timeout: 300,
    })
}