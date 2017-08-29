
Type = require "Type"

type = Type "PromiseTracer"

type.defineValues ->

  _promises: new Set

  _data: new Map

type.defineGetters

  promises: ->
    promises = []
    @_promises.forEach (promise) =>
      promises.push @_inspect promise
    return promises

  pending: -> @_filter "isPending"

  fulfilled: -> @_filter "isFulfilled"

  rejected: -> @_filter "isRejected"

type.defineMethods

  trace: (promise, parent) ->

    return if @_promises.has promise
    @_promises.add promise
    promise._tracer = this

    @_data.set promise, data =
      name: promise.__name
      parent: parent or null
      children: new Set

    if parent
      @trace parent unless @_data.has parent
      parentData = @_data.get parent
      parentData.children.add promise
    return

  getChildren: (promise) ->
    if children = @_childMap.get promise
    then Array.from children
    else []

  getParent: (promise) ->
    @_parentMap.get promise

  _filter: (key) ->
    promises = []
    @_promises.forEach (promise) =>
      return unless promise[key]
      promises.push @_inspect promise
    return promises

  _inspect: (promise) ->
    data = @_data.get promise
    data = Object.assign {}, data, promise.inspect()
    data.children = Array.from data.children
    return data

module.exports = PromiseTracer = type.build()
