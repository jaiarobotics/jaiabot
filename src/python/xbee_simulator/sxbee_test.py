from sxbee_radio import SimXBee, SimXBeeGroup
import logging

def main():
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)10s %(message)s'
        )
    logger = logging.getLogger(__name__)

    print(logger.handlers)

    logger.info('TESTING XBEE SIMULATOR')
    print(logger.propagate)
    
    xbees = [
        'xbeebot0',
        'xbeehub0'
    ]

    sxbg = SimXBeeGroup(xbees)
    logger.info('XBees created!')
    sxbg.start()
    logger.info('XBees started!')

    try:
        while True:
            pass
    except KeyboardInterrupt:
        pass
    finally:
        sxbg.close()


if __name__ == "__main__":
    main()
