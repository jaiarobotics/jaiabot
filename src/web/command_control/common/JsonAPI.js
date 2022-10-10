module.exports = function JsonAPI(url) {
  return {
    hit(method, endpoint, requestBody) {
      const request = {
        method,
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      };
      if (method === 'POST') {
        request.body = JSON.stringify(requestBody);
      }

      // TODO add get params

      return fetch(`${url}/${endpoint}`, request)
        .then(
          (response) => {
            if (response.ok) {
              try {
                return response.json();
              } catch (error) {
                console.error('Error parsing response json');
                console.error(error);
                return response.text();
              }
            }
            return Promise.reject(
              new Error(`Error from ${method} to api: ${response.status} ${response.statusText}`)
            );
          },
          (reason) => {
            console.error(`Failed to ${method} JSON request: ${reason}`);
            console.error('Request body:');
            console.error(requestBody);
            return Promise.reject(new Error('Response parse fail'));
          }
        )
        .then(
          (res) => {
            if (this.debug) console.log(`Response: ${res.code} ${res.msg}`);
            return res;
          },
          reason => reason
        );
    },

    post(endpoint, body) {
      return this.hit('POST', endpoint, body);
    },

    get(endpoint, body) {
      return this.hit('GET', endpoint, body);
    }
  };
};
