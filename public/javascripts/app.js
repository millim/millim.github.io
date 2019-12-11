function getQueryString(name) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == name) { return pair[1]; }
  }
  return (false);
}


function getShowObj(curTag){
  return function isOnlyShow(name) {
    if (curTag === "false") {
      $("#group-" + name).show()
      return
    }
    if (curTag == name) {
      $("#group-" + name).show()
    }
  }
}