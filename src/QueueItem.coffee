
Shape = require "Shape"
Type = require "Type"

type = Type "QueueItem"

type.argumentTypes =
  promise: Object.Kind
  onFulfilled: Function.Maybe
  onRejected: Function.Maybe

type.createInstance (promise, onFulfilled, onRejected) ->
  { promise, onFulfilled, onRejected }

type.defineMethods

  fulfill: (promise) ->
    @promise._unwrap @onFulfilled, promise

  reject: (promise) ->
    @promise._unwrap @onRejected, promise

module.exports = type.build()
