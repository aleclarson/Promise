
{ Shape } = require "type-utils"

Type = require "Type"

type = Type "QueueItem"

type.argumentTypes =
  promise: Object.Kind
  onFulfilled: Function.Maybe
  onRejected: Function.Maybe

type.initInstance (promise, onFulfilled, onRejected) ->

  @promise = promise

  if isType onFulfilled, Function
    @onFulfilled = onFulfilled
    @fulfill = @_resolveFulfilled

  if isType onRejected, Function
    @onRejected = onRejected
    @reject = @_resolveRejected

type.defineMethods

  fulfill: (value) ->
    @promise._tryFulfilling value

  reject: (error) ->
    @promise._reject error

  _resolveFulfilled: (value) ->
    @promise._unwrap @onFulfilled, value

  _resolveRejected: (error) ->
    @promise._unwrap @onRejected, error

module.exports = type.build()
