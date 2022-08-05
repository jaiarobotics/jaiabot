all: release

release:
	cd client; npm install; npm run release

install: all
	cd server; sudo ./install_services.py

# For active development
test:
	cd client; npm install; npm run test
