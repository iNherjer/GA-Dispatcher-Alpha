import http.server
import socketserver
import os
import sys
import json
from pathlib import Path

port = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get('PORT', 8080))
host = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('HOST', '')
root = Path(__file__).resolve().parent
published_front_path = root / 'e6b' / 'e6b-workbench-front-disc.json'
published_wind_path = root / 'e6b' / 'e6b-workbench-wind-disc.json'
os.chdir(root)


class WorkbenchHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        path = self.path.split('?', 1)[0]
        if path == '/api/e6b/front-disc':
            output_path = published_front_path
            validator = self._valid_front_snapshot
            invalid_message = 'Invalid E6B front snapshot'
        elif path == '/api/e6b/wind-disc':
            output_path = published_wind_path
            validator = self._valid_wind_snapshot
            invalid_message = 'Invalid E6B wind snapshot'
        else:
            self.send_error(404, 'Not found')
            return

        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            length = 0

        if length <= 0 or length > 12 * 1024 * 1024:
            self.send_error(413, 'Invalid payload size')
            return

        try:
            payload = self.rfile.read(length).decode('utf-8')
            data = json.loads(payload)
        except Exception:
            self.send_error(400, 'Invalid JSON')
            return

        if not validator(data):
            self.send_error(422, invalid_message)
            return

        try:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = output_path.with_suffix('.json.tmp')
            with tmp_path.open('w', encoding='utf-8') as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2)
                handle.write('\n')
            tmp_path.replace(output_path)
        except Exception as error:
            self.send_error(500, f'Could not write snapshot: {error}')
            return

        body = json.dumps({
            'ok': True,
            'path': str(output_path.relative_to(root)),
            'bytes': output_path.stat().st_size
        }).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        if self.path.split('?', 1)[0].endswith('.json'):
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    @staticmethod
    def _valid_front_snapshot(data):
        if not isinstance(data, dict):
            return False
        svgs = data.get('svgs')
        if not isinstance(svgs, dict):
            return False
        return (
            isinstance(svgs.get('front'), str)
            and '<svg' in svgs['front']
            and isinstance(svgs.get('back'), str)
            and '<svg' in svgs['back']
        )

    @staticmethod
    def _valid_wind_snapshot(data):
        if not isinstance(data, dict):
            return False
        svgs = data.get('svgs')
        if not isinstance(svgs, dict):
            return False
        wind = data.get('wind')
        return (
            isinstance(wind, dict)
            and isinstance(svgs.get('slider'), str)
            and '<svg' in svgs['slider']
            and isinstance(svgs.get('rotor'), str)
            and '<svg' in svgs['rotor']
        )


class ReusableTCPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


with ReusableTCPServer((host, port), WorkbenchHandler) as httpd:
    shown_host = host or '0.0.0.0'
    print(f"Serving on {shown_host}:{port}")
    print("E6B publish endpoint: /api/e6b/front-disc -> e6b/e6b-workbench-front-disc.json")
    print("E6B publish endpoint: /api/e6b/wind-disc -> e6b/e6b-workbench-wind-disc.json")
    httpd.serve_forever()
