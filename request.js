export function handleOptions(request) {
  let headers = request.headers;
  if (
    headers.get("Origin") !== null &&
    headers.get("Access-Control-Request-Method") !== null &&
    headers.get("Access-Control-Request-Headers") !== null
  ){
    let respHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
    }

    return new Response(null, {
      headers: respHeaders,
    })
  } else {
    return new Response(null, {
      headers: {
        Allow: "GET, HEAD, POST, OPTIONS",
      },
    })
  }
}
