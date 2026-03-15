import vertexai; from vertexai.generative_models import GenerativeModel; regions = ['us-central1', 'us-east4', 'us-west1', 'us-west4', 'europe-west1', 'europe-west4', 'europe-west9', 'asia-northeast1', 'asia-northeast3', 'asia-southeast1', 'northamerica-northeast1']; 
for r in regions:
 try:
  vertexai.init(project='project-2dc5bd49-c8ce-4889-95a', location=r)
  m = GenerativeModel('gemini-1.5-flash')
  print(f'{r}: ', m.generate_content('hi').text[:5])
 except Exception as e:
  print(f'{r}: FAILED - {type(e).__name__}')
