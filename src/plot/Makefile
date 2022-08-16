all: release

release:
	cd client; npm install; npm run release

install: all
	sudo mkdir -p /opt/jaiaplot
	sudo chmod ugo+rwx /opt/jaiaplot

	sudo mkdir -p /var/log/jaiabot/bot_offload/jaiaplot
	sudo chmod ugo+rwx /var/log/jaiabot/bot_offload/jaiaplot

	rsync -aP server client /opt/jaiaplot
	cd /opt/jaiaplot/server; sudo ./install_services.py

	systemctl daemon-reload
	sudo systemctl restart jaia_plot_server jaia_goby_converter
