import importlib
try:
    mp = importlib.import_module('mediapipe')
    v = importlib.import_module('mediapipe.tasks.python.vision')
    print('mediapipe', getattr(mp, '__version__', '<unknown>'))
    names = [a for a in dir(v) if not a.startswith('_')]
    print('vision attrs:', names)
except Exception as e:
    print('ERROR:', e)
