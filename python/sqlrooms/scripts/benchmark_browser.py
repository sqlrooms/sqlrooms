"""Serve an opt-in browser transport benchmark using either revision's interpreter.

Open the printed loopback launch link in a real browser; results are rendered on
that page and printed to stdout. Uses a disposable database and page credential.
This measures transport (not React chart rendering), with the server's settings.
"""

import asyncio
import json
import os
from pathlib import Path
import socket
import tempfile

from fastapi.responses import HTMLResponse
from starlette.routing import Route
from sqlrooms.web.launcher import SqlroomsHttpServer

PAGE = r"""<!doctype html><title>SQLRooms browser transport benchmark</title>
<h1>SQLRooms browser transport benchmark</h1><pre id="result">Running...</pre>
<script>
(async () => {
  const result = document.getElementById('result');
  try {
    const ticket = new URLSearchParams(location.hash.slice(1)).get('sqlrooms-ticket');
    history.replaceState(null, '', location.pathname);
    const response = await fetch('/api/auth/exchange', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticket})});
    const auth = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(auth));
    const connect = async () => {
      const ws = new WebSocket(location.origin.replace('http','ws')+'/ws/duckdb');
      ws.binaryType = 'arraybuffer';
      const waiting = [], received = [];
      ws.onmessage = ({data}) => waiting.length ? waiting.shift()(data) : received.push(data);
      ws.next = () => received.length ? Promise.resolve(received.shift()) : Promise.race([new Promise(resolve => waiting.push(resolve)), new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timed out at '+result.textContent)),30000))]);
      ws.onclose = event => { result.textContent += ' CLOSED '+event.code+' '+event.reason };
      await new Promise((resolve,reject) => {ws.onopen=resolve;ws.onerror=reject});
      ws.send(JSON.stringify({type:'auth',token:auth.token}));
      if (JSON.parse(await ws.next()).type !== 'authAck') throw new Error('auth failed');
      return ws;
    };
    const send = (ws,sql,queryId,type='arrow') => ws.send(JSON.stringify({type,sql,queryId}));
    const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
    const runs=[];
    for (let run=0;run<3;run++) {
      result.textContent=`Run ${run}: connect`;
      const ws=await connect(), control=await connect();
      result.textContent=`Run ${run}: cold/warm`;
      let at=performance.now();send(ws,'SELECT sum(i) FROM range(1000000) t(i)','cold');await ws.next();
      const cold_ms=performance.now()-at, warm=[];
      for (let i=0;i<10;i++){at=performance.now();send(ws,'SELECT sum(i) FROM range(1000000) t(i)',`w${i}`);await ws.next();warm.push(performance.now()-at)}
      at=performance.now();
      for(let i=0;i<8;i++)send(ws,'SELECT sum(i) FROM range(1000000) t(i)',`burst${i}`);
      for(let i=0;i<8;i++)await ws.next();
      const burst8_ms=performance.now()-at;
      result.textContent=`Run ${run}: large`;
      at=performance.now();send(ws,'SELECT i, md5(i::varchar) AS text FROM range(1000000) t(i)','large');
      const arrow=await ws.next(),large_ms=performance.now()-at;
      if(!(arrow instanceof ArrayBuffer))throw new Error(String(arrow));
      send(ws,'SELECT i FROM range(1000000) t(i)','upload-source');
      const source=await ws.next();
      const offset=new DataView(source).getUint32(0)+4;
      const header=new TextEncoder().encode(JSON.stringify({type:'uploadArrow',tableName:`upload${run}`,queryId:'upload'}));
      const upload=new Uint8Array(4+header.length+source.byteLength-offset);
      new DataView(upload.buffer).setUint32(0,header.length);upload.set(header,4);upload.set(new Uint8Array(source,offset),4+header.length);
      result.textContent=`Run ${run}: upload`;
      at=performance.now();ws.send(upload);const uploadAck=JSON.parse(await ws.next());if(uploadAck.type!=='uploadAck')throw new Error(JSON.stringify(uploadAck));const upload_ms=performance.now()-at;
      result.textContent=`Run ${run}: slow/cancel`;
      const health=[];let observing=true;
      const observer=(async()=>{while(observing){const start=performance.now();await fetch('/healthz');health.push(performance.now()-start);await delay(10)}})();
      at=performance.now();
      for(let i=0;i<3;i++)send(ws,'SELECT i, md5(i::varchar) AS text FROM range(1000000) t(i)',`slow${i}`);
      send(control,'SELECT sum(i) FROM range(10000000000) t(i)','long','json');await delay(200);
      const cancelAt=performance.now();control.send(JSON.stringify({type:'cancel',queryId:'long'}));
      while(JSON.parse(await control.next()).type!=='cancelAck'){}
      const cancel_ms=performance.now()-cancelAt;
      await delay(500);for(let i=0;i<3;i++)await ws.next();
      const slow_three_ms=performance.now()-at;observing=false;await observer;
      const dropped=await connect();send(dropped,'SELECT i, md5(i::varchar) FROM range(1000000) t(i)','dropped');dropped.close();
      ws.close();control.close();
      runs.push({cold_ms,warm_median_ms:warm.sort((a,b)=>a-b)[5],burst8_ms,large_ms,arrow_bytes:arrow.byteLength,upload_ms,cancel_ms,slow_three_ms,health_max_ms:Math.max(...health)});
    }
    const value={client:navigator.userAgent,compression:'Browser offers deflate; runtime chooses; see paired server settings',runs};
    result.textContent=JSON.stringify(value,null,2);
    await fetch('/benchmark-result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
  } catch(error){result.textContent='FAILED: '+error.stack}
})();
</script>"""


async def main():
    with tempfile.TemporaryDirectory(prefix="sqlrooms-browser-bench-") as directory:
        os.environ["SQLROOMS_HOME"] = str(Path(directory) / "home")
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        server = SqlroomsHttpServer(
            ":memory:", "127.0.0.1", port, None, serve_ui=False, open_browser=False
        )
        build = server._build_app

        def build_benchmark():
            app = build()

            async def page(_request):
                return HTMLResponse(PAGE)

            async def record(request):
                value = await request.json()
                print("RESULT " + json.dumps(value), flush=True)
                return HTMLResponse("Recorded")

            app.router.routes.insert(0, Route("/benchmark", page))
            app.router.routes.insert(
                0, Route("/benchmark-result", record, methods=["POST"])
            )
            return app

        server._build_app = build_benchmark

        async def ready():
            ticket = server.access.ticket()
            print(
                f"OPEN http://127.0.0.1:{port}/benchmark#sqlrooms-ticket={ticket}",
                flush=True,
            )
            await asyncio.Event().wait()

        await server.start(ready)


if __name__ == "__main__":
    asyncio.run(main())
