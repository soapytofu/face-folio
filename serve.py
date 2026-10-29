"""Run Facefolio locally, using a stable origin so saved rosters persist."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import webbrowser

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--no-open', action='store_true', help='Do not open a browser automatically')
args = parser.parse_args()
root = Path(__file__).resolve().parent / 'dist'
url = 'http://127.0.0.1:4173'
try:
    server = ThreadingHTTPServer(('127.0.0.1', 4173), partial(SimpleHTTPRequestHandler, directory=str(root)))
except OSError as error:
    raise SystemExit(f'Could not start Facefolio: {error}\nIf Facefolio is already running, open {url}. Otherwise stop the program using port 4173 and try again.')
print(f'Facefolio is ready at {url}\nKeep this window open while using the app. Press Control-C to stop.', flush=True)
if not args.no_open:
    webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    print('\nFacefolio stopped. Your saved rosters remain in your browser.')
finally:
    server.server_close()
