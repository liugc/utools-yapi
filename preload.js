const http = require("http");
const querystring = require("querystring");

var lists = [];

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
      let rawData = "";
      res.on('data', (chunk) => { rawData += chunk });
      res.on('end', () => {
        try {
          let jsonData = JSON.parse(rawData);
          if (jsonData.data) {
            resolve(rawData);
          } else {
            reject(rawData);
          }
        } catch(e) {
          resolve(rawData);
        }
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
    let project = utools.db.get('project').data;
    let matchUrl = project.match(/https?:\/\/.+?(com|cn|net|org)/);
    let matchId = project.match(/group\/(\d+)/);
    let url = matchUrl[0];
    let id = matchId[1];
    request.get(`${url}/api/project/list?group_id=${id}&page=1&limit=100`)
      .then((body) => {
        let list = JSON.parse(body).data.list;
        resolve(list);
      })
      .catch((e) => {
        reject(e);
      });
  });
}

const getInterface = (project_id) => {
  return new Promise((resolve, reject) => {
    let project = utools.db.get('project').data;
    let matchUrl = project.match(/https?:\/\/.+?(com|cn|net|org)/);
    let url = matchUrl[0];
    request.get(`${url}/api/interface/list?page=1&limit=200&project_id=${project_id}`)
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
  let project = utools.db.get('project');
  if (!project) {
    utools.showNotification("请先输入项目地址");
    return;
  }
  let matchUrl = project.data.match(/https?:\/\/.+?(com|cn|net|org)/);
  let url;
  if (matchUrl) {
    url = matchUrl[0];
  }
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
        item.url = `${url}/project/${item.project_id}/interface/api/${item._id}`;
        return item;
      });
      if (callbackSetList) {
        callbackSetList(lists);
      }
      let dbLists = utools.db.get('lists');
      let obj = {
        _id: 'lists',
        data: lists
      };
      if (dbLists) {
        obj._rev = dbLists._rev;
      }
      utools.db.put(obj);
    });
  }).catch((err) => {
    utools.showNotification(JSON.parse(err).errmsg);
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
        let dbLists = utools.db.get('lists');
        if (dbLists && dbLists.data.length > 0) {
          lists = dbLists.data;
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
  "update": {
    mode: "none",
    args: {
      enter: (action, callbackSetList) => {
        utools.hideMainWindow();
        getAllInterface(callbackSetList);
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
      },
      placeholder: "请输入_yapi_token的cookie值"
    }
  },
  "project": {
    mode: "list",
    args: {
      search: (action, searchWord, callbackSetList) => {
        callbackSetList([{
          title: searchWord,
          description: ''
        }]);
      },
      select: (action, itemData) => {
        if (!/https?:\/\/.+?(com|cn|net|org)/.test(itemData.title)) {
          utools.showNotification("请输入正确的项目地址");
        } else {
          utools.hideMainWindow();
          let project = utools.db.get('project');
          let obj = {
            _id: 'project',
            data: itemData.title
          }
          if (project) {
            obj._rev = project._rev;
          }
          utools.db.put(obj);
          utools.outPlugin();
        }
      },
      placeholder: "请输入yapi项目地址"
    }
  }
}