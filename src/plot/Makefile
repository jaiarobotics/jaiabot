all: _client

_client:
	cd client; npm install; npm run release

test: _client
	cd server; ./jaia_plot_server.py

install: all
	cd server; sudo ./install_services.py
