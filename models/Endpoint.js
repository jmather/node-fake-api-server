class Endpoint {
    Methods = Object.freeze({
        Get: "get",
        Post: "post",
        Put: "put",
        Patch: "patch",
        Delete: "delete",
        Head: "head",
        Options: "options",
    });

    ResponseModes = Object.freeze({
        Incremental: "incremental",
        Random: "random",
    });

    method = this.Methods.Get;
    path = "/";
}

module.exports = Endpoint;