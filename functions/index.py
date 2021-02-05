import os
import tempfile

from google.cloud import storage
from veryfi import Client

# --- Environment variables ---
client_id = os.getenv('CLIENT_ID')
client_secret = os.getenv('CLIENT_SECRET')
api_key = os.getenv('API_KEY')
user_name = os.getenv('USER_NAME')
ocr_host = os.getenv('OCR_HOST')
doc_path = os.getenv('DOC_PATH')

def print_env():
  print('===')
  print('client_id: ' + client_id)
  print('user_name: ' + user_name)
  print('===')

# --- setup clients ---
storage_client = storage.Client()
verify_client = Client(client_id, client_secret, user_name, api_key)

# --- storage event listener ---
def on_new_image(data, context):
  file_data = data
  file_name = data["name"]
  bucket_name = data["bucket"]

  temp_file = tempfile.NamedTemporaryFile()
  temp_file_name = temp_file.name

  print('src: ' + file_name)
  print('tmp: ' + temp_file_name)

  print('src_name:' + file_name.rsplit('/', 1)[-1])

  blob = storage_client.bucket(bucket_name).get_blob(file_name)
  with open(temp_file_name, 'wb') as file_obj:
    blob.download_to_file(file_obj)

  temp_file.flush()

  print('out size: ' + str(os.path.getsize(temp_file_name)))

  response = verify_client.process_document(temp_file_name)
  print (response.json())
