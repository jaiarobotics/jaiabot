all: release

release:
	cd client; npm install; npm run release

install: all
	sudo mkdir -p /opt/jaiabot_data_vision
	sudo chmod ugo+rwx /opt/jaiabot_data_vision

	sudo mkdir -p /var/log/jaiabot/bot_offload
	sudo chmod ugo+rwx /var/log/jaiabot/bot_offload

	rsync -aLP server client /opt/jaiabot_data_vision
	cd /opt/jaiabot_data_vision/server; sudo ./install_services.py

	sudo systemctl daemon-reload
	sudo systemctl enable jaiabot_data_vision jaiabot_log_converter
	sudo systemctl restart jaiabot_data_vision jaiabot_log_converter
