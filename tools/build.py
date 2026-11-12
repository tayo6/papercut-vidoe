import sys, os
d=sys.argv[1]
head=open(d+'/h_head.html',encoding='utf-8').read().replace('/*FONTS*/',open(d+'/fonts.css',encoding='utf-8').read())+'<style>\n'+open(d+'/h_edit.css',encoding='utf-8').read()+'\n</style>\n'
body=open(d+'/h_body.html',encoding='utf-8').read()+open(d+'/h_edit.html',encoding='utf-8').read()
names=['u_utils','s_subject','s_paper','m_cutout','m_fold','m_text','m_news','a_audio_gif','e_core','e_media','e_audio','e_render','e_ui','e_ui_tl','e_ui_bar','e_ui_insp','v_mp4mux','v_webmmux','e_export','z_main']
js='\n'.join(open('%s/%s.js'%(d,n),encoding='utf-8').read() for n in names)
page=head+body+'<script>\n'+js+'\n</script>\n'
t='<title>Snipwork</title>'
meta='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>html,body{margin:0}body{font:14px system-ui,sans-serif}</style>'
if page.startswith(t): page=t+meta+page[len(t):]
out=sys.argv[2] if len(sys.argv)>2 else d+'/index.html'
os.makedirs(os.path.dirname(os.path.abspath(out)),exist_ok=True)
open(out,'w',encoding='utf-8').write(page)
print('built',len(head+body+js))
