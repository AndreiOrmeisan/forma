import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

process.env.NEXT_PUBLIC_PROJECT_STORAGE = "api";

test("project requests send the current session bearer token and no owner header", async context => {
  let request;
  const {projectRequest} = loadTypeScriptModule("src/features/furniture/project-api.ts", {
    "../auth/supabase-client":{projectAccessToken:async()=>"verified-by-backend"},
  });
  context.mock.method(globalThis,"fetch",async(url,options)=>{request={url,options};return Response.json({items:[]});});
  await projectRequest("projects");
  assert.equal(request.options.headers.Authorization,"Bearer verified-by-backend");
  assert.ok(!("X-User-Id" in request.options.headers));
});

test("unauthorized cloud requests report expired login instead of success",async context=>{
  const {projectRequest} = loadTypeScriptModule("src/features/furniture/project-api.ts", {
    "../auth/supabase-client":{projectAccessToken:async()=>null},
  });
  context.mock.method(globalThis,"fetch",async()=>Response.json({}, {status:401}));
  await assert.rejects(projectRequest("projects"),/Autentifică-te/);
});

test("account UI explains configuration, supports Google login and shows only public user info",()=>{
  const render = account => {
    const {AccountPanel} = loadTypeScriptModule("src/features/auth/account-panel.tsx", {
      "./auth-context":{useAuth:()=>({loading:false,configured:true,error:null,signIn:async()=>{},signOut:async()=>{},...account})},
    });
    return renderToStaticMarkup(React.createElement(AccountPanel));
  };
  assert.match(render({user:null}),/Continuă cu Google/);
  assert.match(render({configured:false,user:null}),/nu este încă activată/);
  const signedIn = render({user:{id:"private-user-id",email:"test@example.com"}});
  assert.match(signedIn,/Deconectare/);
  assert.match(signedIn,/test@example.com/);
  assert.ok(!signedIn.includes("private-user-id"));
});

test("switching accounts clears previous project state; first login preserves guest input",()=>{
  let user=null,state;
  const {WardrobeProjectProvider} = loadTypeScriptModule("src/features/furniture/wardrobe-project-context.tsx", {
    react:{...React,useCallback:fn=>fn,useState(initial){state ??= initial;return [state,next=>{state=typeof next==="function"?next(state):next;}];}},
    "../auth/auth-context":{useAuth:()=>({user})},
    "@/components/image-upload/image-draft-context":{useImageDraft:()=>({image:null})},
  });
  const render=()=>WardrobeProjectProvider({children:null}).props.value;
  render().acceptInterpretation({width_mm:800,height_mm:2000,depth_mm:600,doors_count:2,shelves_count:3,furniture_type:"wardrobe",is_mock:true,requires_confirmation:true,notice:"demo"});
  user={id:"user-a"};render();
  assert.equal(render().draft.width_mm,"800");
  user={id:"user-b"};render();
  assert.equal(render().draft,null);
  assert.equal(render().savedProject,null);
});

test("Google login opens a popup without navigating away from the current project",async context=>{
  const popup={opener:{},location:{href:"about:blank"},close(){}};
  let options,opened;
  const previous=globalThis.window;
  globalThis.window={location:{origin:"https://example.com",href:"https://example.com/current-project"},open(...args){opened=args;return popup;}};
  context.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  const {AuthProvider}=loadTypeScriptModule("src/features/auth/auth-context.tsx",{
    react:{...React,useEffect:()=>{},useState(initial){return [typeof initial==="function"?initial():initial,()=>{}];}},
    "./supabase-client":{getSupabase:()=>({auth:{signInWithOAuth:async value=>{options=value;return {data:{url:"https://accounts.example.com/oauth"},error:null};}}})},
  });
  await AuthProvider({children:null}).props.value.signIn();
  assert.equal(options.provider,"google");
  assert.equal(options.options.skipBrowserRedirect,true);
  assert.ok(options.options.redirectTo.endsWith("/domenii/mobilier/profil/"));
  assert.equal(opened[0],"about:blank");
  assert.equal(popup.opener,null);
  assert.equal(popup.location.href,"https://accounts.example.com/oauth");
  assert.equal(globalThis.window.location.href,"https://example.com/current-project");
});

test("build configuration rejects secret keys before they can enter a public bundle",context=>{
  const oldUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  context.after(()=>{
    if(oldUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=oldKey;
  });
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_secret_never_publish";
  assert.throws(()=>loadTypeScriptModule("next.config.ts"),/never a secret/);
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_test";
  assert.ok(loadTypeScriptModule("next.config.ts").default);
});
