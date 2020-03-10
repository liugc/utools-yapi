const http = require("http");
const querystring = require("querystring");

let lists = [];

const _request = (options) => {
  options.headers = options.headers || {};
  options.headers.Cookie = "OZ_1U_2844=vid=ve4fa94331e268.0&ctime=1583400876&ltime=1583375000; _yapi_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjM4OSwiaWF0IjoxNTgzODY3NDc0LCJleHAiOjE1ODQ0NzIyNzR9.po-mwYiWF75iLQyDoeSVPUed583CVdUYUSk3atnOlmo; _yapi_uid=389";
  console.log("--- request ---");
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
    console.log("--- GET ---");
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
  console.log(request.get("http://yapi.dashuf.com/api/project/list?group_id=20&page=1&limit=100"));
  console.log("--- finish ---");
  return new Promise((resolve, reject) => {
    request.get("http://yapi.dashuf.com/api/project/list?group_id=20&page=1&limit=100")
      .then((body) => {
        console.log(body);
        let list = JSON.parse(body).data.list;
        resolve(list);
      })
      .catch((e) => {
        console.log(e);
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
        console.log(e);
        reject();
      });
  });
}

const getAllInterface = () => {
  console.log("--- start ---");
  getList().then((list) => {
    let promiseArr = [];
    list.forEach((item) => {
      promiseArr.push(getInterface(item._id));
    });
    console.log(list);
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
      console.log(lists);
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

getAllInterface();