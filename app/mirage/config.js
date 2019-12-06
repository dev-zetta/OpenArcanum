export default function() {
  // These comments are here to help you get started. Feel free to delete them.

  /*
    Config (with defaults).

    Note: these only affect routes defined *after* them!
  */

  // this.urlPrefix = '';    // make this `http://localhost:8080`, for example, if your API is on a different server
  // this.namespace = '';    // make this `/api`, for example, if your API is namespaced
  // this.timing = 400;      // delay for each request, automatically set to 0 during testing

  /*
    Shorthand cheatsheet:

    this.get('/posts');
    this.post('/posts');
    this.get('/posts/:id');
    this.put('/posts/:id'); // or this.patch
    this.del('/posts/:id');

    http://www.ember-cli-mirage.com/docs/v0.3.x/shorthands/
  */

  /*this.get('/authors', (schema, request) => {
    return schema.authors.all();
  });*/

  function parseFilterQueryParams(queryParams) {
    let filterQueryParams = {}
    for (let key in queryParams) {
      if (key.startsWith(`filter`)) {
        let field = key.slice(7, key.indexOf(`]`))
        filterQueryParams[field] = queryParams[key]
      }
    }
    return filterQueryParams
  }

  this.get(`/gui-widgets`, (schema, request) => {
    let filter = parseFilterQueryParams(request.queryParams)
    return schema.guiWidgets.where(filter)
  })

  this.get(`/gui-widgets/:id`, ({ guiWidgets }, request) => {
    let id = request.params.id

    return guiWidgets.find(id) // users in the second case
  })

  //this.passthrough('https://conversejs.org/**');

}
