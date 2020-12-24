const http = require("http");
const https = require("https");
const querystring = require("querystring");

var lists = [];
let protocol;
let cookie;

const login = () => {
  return new Promise((resolve, reject) => {
    let email = utools.db.get('email');
    let password = utools.db.get('password');
    if (!email) {
      reject(new Error("请先输入email"));
      return;
    }
    if (!password) {
      reject(new Error("请先输入password"));
      return;
    }
    let url = utools.db.get('project').data;
    if (url.indexOf("https") === 0) {
      protocol = https;
    } else {
      protocol = http;
    }
    const req = protocol.request(`${url}/api/user/login_by_ldap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
      }
    }, (res) => {
      let rawData = "";
      res.on("data", (chunk) => {
        rawData += chunk;
      }).on("end", () => {
        let data = JSON.parse(rawData);
        let errcode = data.errcode;
        if (errcode !== 0) {
          reject(data.errmsg);
        } else {
          let cookies = res.headers['set-cookie'];
          let arr = [];
          if (cookies && cookies.length > 0) {
            cookies.forEach((item) => {
              arr.push(item.split(";")[0]);
            });
            cookie = arr.join("; ");
            resolve(cookie);
          }
        }
      });
    });
    req.on('error', (err) => {
      reject(err.message);
    });
    req.write(JSON.stringify({
      email: email.data,
      password: password.data
    }));
    req.end();
  });
}

const _request = (options) => {
  options.headers = options.headers || {};
  return new Promise(async (resolve, reject) => {
    if (!cookie) {
      cookie = await login().catch((err) => {
        reject(err);
      });
    }
    if (cookie) {
      options.headers.Cookie = cookie;
    }
    if (options.url.indexOf("https") === 0) {
      protocol = https;
    } else {
      protocol = http;
    }
    const req = protocol.request(options.url, {
      method: options.method,
      headers: options.headers
    }, (res) => {
      let rawData = "";
      res.on('data', (chunk) => { rawData += chunk });
      res.on('end', () => {
        try {
          let jsonData = JSON.parse(rawData);
          if (jsonData.data) {
            resolve(jsonData.data);
          } else {
            resolve(jsonData);
          }
        } catch(e) {
          resolve(rawData);
        }
      });
    });
    req.on('error', (err) => {
      utools.showNotification(err.message);
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
    request.get(`${url}/api/project/list?group_id=${id}&page=1&limit=100000`)
      .then((body) => {
        let list = body.list;
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
      .then(async (body) => {
        if (body) {
          if (body instanceof Array) {
            let projects = body;
            let arr = [];
            for (let i=0; i<projects.length; i++) {
              let list = await getProject(url, projects[i]._id);
              arr.push(...list);
            }
            resolve(arr);
          } else {
            reject(new Error(body.errmsg));
          }
        } else {
          reject(new Error("请检查项目地址是否正确"));
        }
      })
      .catch((err) => {
        reject(err);
      })
  });
}

const getInterface = (project_id) => {
  return new Promise((resolve, reject) => {
    let url = utools.db.get('project').data;
    request.get(`${url}/api/interface/list?page=1&limit=200000&project_id=${project_id}`)
      .then((body) => {
        let list = body.list;
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
      cookie = "";
    });
  }).catch((err) => {
    try {
      err = JSON.parse(err).errmsg;
    } catch(e) {
      if (typeof err === "object") {
        err = err.message;
      }
    }
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
      enter: () => {
        utools.hideMainWindow();
        getAllInterface(() => {
          utools.showNotification("更新接口完成");
          utools.outPlugin();
        });
      }
    }
  },
  "email": {
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
        let email = utools.db.get('email');
        let obj = {
          _id: 'email',
          data: itemData.title
        }
        if (email) {
          obj._rev = email._rev;
        }
        utools.db.put(obj);
        utools.outPlugin();
      },
      placeholder: "请输入yapi登录的邮箱"
    }
  },
  "password": {
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
        let password = utools.db.get('password');
        let obj = {
          _id: 'password',
          data: itemData.title
        }
        if (password) {
          obj._rev = password._rev;
        }
        utools.db.put(obj);
        utools.outPlugin();
      },
      placeholder: "请输入yapi登录的密码"
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