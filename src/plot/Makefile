all: release

release:
	cd client; npm install; npm run release

install: all
	sudo mkdir -p /opt/jaiabotplot
	sudo chmod ugo+rwx /opt/jaiabotplot

	sudo mkdir -p /var/log/jaiabot/bot_offload
	sudo chmod ugo+rwx /var/log/jaiabot/bot_offload

	rsync -aP server client /opt/jaiabotplot
	cd /opt/jaiabotplot/server; sudo ./install_services.py

	sudo systemctl daemon-reload
	sudo systemctl enable jaiabot_plot jaiabot_log_converter
	sudo systemctl restart jaiabot_plot jaiabot_log_converter
