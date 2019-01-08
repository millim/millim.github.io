if [ $1 == 'dev' ]
then
  jekyll server --drafts
fi

if [ $1 == 'push' ]
then
  git add .
  git commit -m "$2"
  git push
fi
