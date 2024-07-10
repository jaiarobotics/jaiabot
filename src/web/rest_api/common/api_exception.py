class APIException(Exception):
    def __init__(self, code, details):
        super(APIException, self).__init__(details)
        self.code = code
        self.details = details
