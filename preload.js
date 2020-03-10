const http = require("http");
const querystring = require("querystring");

let lists = [];

const _request = (options) => {
  options.headers = options.headers || {};
  let token = utools.db.get('token');
  if (token) {
    options.headers.Cookie = token.data;
  } else {
    utools.showNotification("请先输入token");
  }
  return new Promise((resolve, reject) => {
    const req = http.request(options.url, {
      method: options.method,
      headers: options.headers
    }, (res) => {
      console.log("--- res ---");
      let rawData = "";
      res.on('data', (chunk) => { rawData += chunk });
      res.on('end', () => {
        console.log(rawData);
        resolve(rawData);
      });
    });
    req.on('error', () => {
      reject();
    });
    req.write(querystring.stringify(options.data));
    req.end();
  });
}

let request = {
  get: (url, options = {}) => {
    options.method = "GET";
    return _request({
      url,
      options
    })
  },
  post: (url, data, options = {}) => {
    options.data = data;
    options.method = "POST";
    return _request({
      url,
      options
    })
  }
}

const getList = () => {
  return new Promise((resolve, reject) => {
    request.get("http://yapi.dashuf.com/api/project/list?group_id=20&page=1&limit=100")
      .then((body) => {
        let list = JSON.parse(body).data.list;
        resolve(list);
      })
      .catch((e) => {
        reject();
      });
  });
}

const getInterface = (project_id) => {
  return new Promise((resolve, reject) => {
    request.get(`http://yapi.dashuf.com/api/interface/list?page=1&limit=200&project_id=${project_id}`)
      .then((body) => {
        let list = JSON.parse(body).data.list;
        resolve(list);
      })
      .catch((e) => {
        reject();
      });
  });
}

const getAllInterface = (callbackSetList) => {
  getList().then((list) => {
    let promiseArr = [];
    list.forEach((item) => {
      promiseArr.push(getInterface(item._id));
    });
    Promise.all(promiseArr).then((data) => {
      let arr = [];
      data.forEach((item) => {
        item.forEach((it) => {
          arr.push(it);
        });
      });
      lists = arr.map((item) => {
        item.description = item.title;
        item.title = item.path;
        item.url = `http://yapi.dashuf.com/project/${item.project_id}/interface/api/${item._id}`;
        return item;
      });
      callbackSetList(lists)
    });
  }).catch((e) => {
    console.log(e);
  });
}

const filterList = (searchWord, callbackSetList) => {
  let data = lists.filter((item) => {
    return item.title.indexOf(searchWord) > -1;
  });
  callbackSetList(data);
}

window.exports = {
  "list": {
    mode: "list",
    args: {
      enter: (action, callbackSetList) => {
        if (lists.length > 0) {
          callbackSetList(lists);
        } else {
          getAllInterface(callbackSetList);
        }
      },
      search: (action, searchWord, callbackSetList) => {
        filterList(searchWord, callbackSetList);
      },
      select: (action, itemData) => {
        utools.hideMainWindow();
        const url = itemData.url;
        require('electron').shell.openExternal(url);
        utools.outPlugin();
      }
    }
  },
  "token": {
    mode: "list",
    args: {
      search: (action, searchWord, callbackSetList) => {
        callbackSetList([{
          title: searchWord,
          description: ''
        }]);
      },
      select: (action, itemData) => {
        utools.hideMainWindow();
        let token = utools.db.get('token');
        let obj = {
          _id: 'token',
          data: itemData.title
        }
        if (token) {
          obj._rev = token._rev;
        }
        utools.db.put(obj);
        utools.outPlugin();
      }
    }
  }
}