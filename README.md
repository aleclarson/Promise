
# Promise 1.0.0 ![experimental](https://img.shields.io/badge/stability-experimental-EC5315.svg?style=flat)

A `Promise` implementation written in CoffeeScript and derived from [calvinmetcalf/lie](https://github.com/calvinmetcalf/lie).

```coffee
# Create a fulfilled Promise!
# If the passed value is a Promise, it is
# returned instead of creating a new Promise.
promise = Promise 100

# Equals true if the Promise is neither fulfilled or rejected.
promise.isPending

# Equals true if the Promise was resolved without error.
promise.isFulfilled

# Equals true if the Promise caught an error.
promise.isRejected
```

### Promise.try(func)

Call a `Function` safely and resolve its result into a `Promise`.

```coffee
promise = Promise.try ->
  #
  # If this function throws, the Promise will be rejected.
  #
  # If this function returns a Promise, we will wait
  # for the Promise to be resolved, and then resolve the
  # Promise created by 'Promise.try'.
  #

# Wait until the Promise is fulfilled, then call this function.
.then (result) ->
  # Do something with the result!

# Wait until the Promise is rejected, then call this function.
# This argument is optional!
, (error) ->
  # Handle the error in here.

# You can use 'promise.fail' as a shortcut
# for 'promise.then(null, onRejected)'.
.fail (error) ->
  # Handle the error in here.
```

### Promise.reject(error)

Create a rejected `Promise` with an `Error.Kind`!

```
promise = Promise.reject Error "Something went wrong!"
```

### Promise.resolve(resolver)

Create a pending `Promise` that is resolved manually.

You must pass a `Function` that takes two arguments:

- `resolve(value)`: If the value is a `Promise`, it is depended on by this `Promise`.

- `reject(error)`: Rejects this `Promise`.

The new `Promise` will remain pending until one of the functions is called.

```coffee
promise = Promise.resolve (resolve, reject) ->
  # Do something here.
```

### Promise.wrap(func)

Wrap a `Function` with a call to `Promise.try`.

This means the `Function` can throw an `Error` to reject the returned `Promise`.

The value returned by your `Function` will attempt to be resolved into a fulfilled `Promise`.

```coffee
func = Promise.wrap (a, b, c) ->
  # Do something here.

# Now you always get a Promise back.
promise = func 1, 2, 3
```

### Promise.ify(func)

Takes a `Function` that expects an `(error, result)` callback.

Returns a `Function` that always returns a `Promise`.

```coffee
# Convert an (error, result) callback into a Promise constructor.
func = Promise.ify (callback) ->
  callback error, result

# Now you always get a Promise back.
promise = func()
```

### Promise.all(array)

Convert all values in the given `Array` into `Promise`s.

Wait for the converted `Promise`s to resolve, then we can resolve the root `Promise`.

If any converted `Promise` is rejected, the root `Promise` is rejected.

```coffee
promise = Promise.all []
.then -> # All of the promises are fulfilled!
.fail -> # One of the promises was rejected!
```

### Promise.map(iterable, iterator)

Iterate over an `Array` or `Object`.

Each call to `iterator` is wrapped by `Promise.try()`.

An array of `Promise`s is then passed to `Promise.all`!

Iteration over `Object.create(null)` is also supported!

```coffee
promise = Promise.map {}, (value, key) ->
  # Return a Promise or any other value.
  # Or throw an error to reject the root promise!
.then -> # All of the promises are fulfilled!
.fail -> # One of the promises was rejected!
```

### Promise.isFulfilled(value)

Returns `true` when the given value is a fulfilled `Promise`.

```coffee
Promise.isFulfilled value
```

### Promise.isRejected(value)

Returns `true` when the given value is a rejected `Promise`.

If the given value is not a `Promise`, the returned value is `true`.

```coffee
Promise.isRejected value
```

### Promise.isPending(value)

Returns `true` when the given value is a pending `Promise`.

```coffee
Promise.isPending value
```
