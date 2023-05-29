import random

ID = "i"
MUTATION = "m"

def random_mutation_id():
    return random.randint(0, 2**64)

class SyncMap:
    def __init__(self, callback):
        self.callback = callback
        self._map = {}

        # Map of key -> (mutation_id, (value,))
        self._optimistic = {}
    
    def __repr__(self) -> str:
        return repr(self._map)

    def __setitem__(self, key, value):
        id = random_mutation_id()
        self._optimistic[key] = (id, (value,))
        self.callback({ID: id, MUTATION: {key: [value]}})

    def __contains__(self, key):
        try:
            self[key]
            return True
        except KeyError:
            return False

    def __getitem__(self, key):
        if key in self._optimistic:
            if self._optimistic[key][1] is None:
                raise KeyError(key)
            return self._optimistic[key][1][0]
        return self._map[key]
    
    def __delitem__(self, key):
        id = random_mutation_id()
        self._optimistic[key] = (id, None)
        self.callback({ID: id, MUTATION: {key: None}})
    
    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default

    def optimistic_reset(self):
        self._optimistic = {}

    def apply(self, mutation):
        for key in mutation[MUTATION].keys():
            if key in self._optimistic:
                if self._optimistic[key][0] == mutation[ID]:
                    del self._optimistic[key]
        for k, v in mutation[MUTATION].items():
            if v is None:
                del self._map[k]
            else:
                self._map[k] = v[0]
