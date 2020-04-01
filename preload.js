const http = require("http");
const querystring = require("querystring");

var lists = [];

const _request = (options) => {
  options.headers = options.headers || {};
  let cookie = utools.db.get('cookie');
  if (cookie) {
    options.headers.Cookie = cookie.data;
  } else {
    utools.showNotification("请先输入cookie");
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
    req.on('error', (err) => {
      utools.showNotification("请检查yapi地址或cookie是否正确");
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

const getProject = (url, id) => {
  return new Promise((resolve, reject) => {
    request.get(`${url}/api/project/list?group_id=${id}&page=1&limit=100`)
      .then((body) => {
        let list = JSON.parse(body).data.list;
        resolve(list);
      })
      .catch((e) => {
        reject(e);
      });
  })
}

const getList = () => {
  return new Promise((resolve, reject) => {
    let url = utools.db.get('project').data;
    request.get(`${url}/api/group/list`)
      .then((body) => {
        let projects = JSON.parse(body).data;
        let promiseArr = [];
        projects.forEach((item) => {
          promiseArr.push(getProject(url, item._id));
        });
        Promise.all(promiseArr).then((data) => {
          let arr = [];
          data.forEach((item) => {
            item.forEach((it) => {
              arr.push(it);
            });
          });
          resolve(arr);
        });
      })
      .catch((err) => {
        reject(err);
      })
  });
}

const getInterface = (project_id) => {
  return new Promise((resolve, reject) => {
    let url = utools.db.get('project').data;
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
    utools.showNotification("请先输入yapi地址");
    return;
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
        item.url = `${project.data}/project/${item.project_id}/interface/api/${item._id}`;
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
    try {
      err = JSON.parse(err).errmsg;
    } catch(e) {}
    utools.showNotification(err);
  });
}

const filterList = (searchWord, callbackSetList) => {
  let data = lists.filter((item) => {
    let title = item.title.toLowerCase();
    let description = item.description.toLowerCase();
    let word = searchWord.toLowerCase();
    return title.indexOf(word) > -1 || description.indexOf(word) > -1;
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
  "cookie": {
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
        let cookie = utools.db.get('cookie');
        let obj = {
          _id: 'cookie',
          data: itemData.title
        }
        if (cookie) {
          obj._rev = cookie._rev;
        }
        utools.db.put(obj);
        utools.outPlugin();
      },
      placeholder: "请输入yapi登录后的cookie值"
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
        if (!/^https?:\/\/.+/.test(itemData.title)) {
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